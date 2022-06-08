import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as cfOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as r53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as path from 'path';
import * as fs from 'fs';

export class PortalStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?:cdk.StackProps) {
    super(scope, id, props);

    const project = process.env.PROJECT;
    const env = process.env.ENV;
    const awsResourceStem = process.env.AWS_STEM || `${project}-${env}-portal`;
    const r53HostedZoneName = process.env.R53_HZ;
    const cfSiteUrl = process.env.CF_URL || 'portal.'+r53HostedZoneName;
    const acmCertificateArn = process.env.ACM_CERT_ARN;
    const s3dummyPageDeploy = process.env.S3_DUMMY_PAGE_DEPLOY || true;
    const cognitoAuthUrl = process.env.COGNITO_AUTH_URL || 'auth.'+r53HostedZoneName;
    const cognitoAadIdpDisplayName = process.env.COGNITO_IDP_DISPLAY_NAME || 'MyAAD';
    const cognitoUiCustomsEnabled = process.env.COGNITO_UI_CUSTOMS_ENABLED || true;
    const cognitoUiCustomCss = process.env.COGNITO_UI_CUSTOM_CSS|| `./files/cognito/cognito-login.css`;
    const aadSamlFederationMetadataXml = process.env.AAD_SAML_FM_XML || `./files/cognito/aad_saml_fm_${env}.xml`;

    // DATA SOURCES
    const r53HostedZone = r53.HostedZone.fromLookup(this, awsResourceStem+'-r53-hz', {
      domainName: r53HostedZoneName,
    });

    const acmCertificate = acm.Certificate.fromCertificateArn(this, awsResourceStem+'-acm-cert', acmCertificateArn);

    // S3 BUCKET
    const frontendS3BucketName = awsResourceStem+'-'+process.env.CDK_DEFAULT_ACCOUNT+'-'+process.env.CDK_DEFAULT_REGION;

    const frontendS3Bucket = new s3.Bucket(this, awsResourceStem+'-s3', {
      bucketName: frontendS3BucketName,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CLOUDFRONT OAI
    const originAccessIdentity = new cf.OriginAccessIdentity(this, awsResourceStem+'-cf-oai');

    // S3 BUCKET POLICY
    const bucketPolicy = new s3.BucketPolicy(this, awsResourceStem+'-s3-policy', {
      bucket: frontendS3Bucket,
    });

    bucketPolicy.node.addDependency(originAccessIdentity);

    bucketPolicy.document.addStatements(
      new iam.PolicyStatement({
        sid: 'AllowCloudFrontOai',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal('arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity '+originAccessIdentity.originAccessIdentityName)],
        actions: ['s3:GetObject'],
        resources: [`${frontendS3Bucket.bucketArn}/*`],
      }),
    );

    bucketPolicy.document.addStatements(
      new iam.PolicyStatement({
        sid: 'ForceSSLOnlyAccess',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal],
        actions: ['s3:*'],
        resources: [
          frontendS3Bucket.bucketArn,
          `${frontendS3Bucket.bucketArn}/*`,
        ],
        conditions: {
          'Bool': {
            'aws:SecureTransport': 'false',
          },
        },
      }),
    );

    // S3 BUCKET DEPLOYMENT
    if(s3dummyPageDeploy) {
      const frontendS3BucketDeployment = new s3deploy.BucketDeployment(this, awsResourceStem+'-s3-deployment', {
        sources: [s3deploy.Source.asset('./files/s3')],
        destinationBucket: frontendS3Bucket,
      });

      frontendS3BucketDeployment.node.addDependency(frontendS3Bucket);
    }

    // CLOUDFRONT DISTRIBUTION
    const cfDistribution = new cf.Distribution(this, awsResourceStem+'-cf-distro', {
      defaultBehavior: {
        origin: new cfOrigins.S3Origin(frontendS3Bucket, {
          originAccessIdentity: originAccessIdentity,
        })
      },
      defaultRootObject: 'index.html',
      priceClass: cf.PriceClass.PRICE_CLASS_100,
      domainNames: [cfSiteUrl],
      certificate: acmCertificate,
      sslSupportMethod: cf.SSLMethod.SNI,
      minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // ROUTE53 CLOUDFRONT ALIAS
    const cfR53Alias = new r53.ARecord(this, awsResourceStem+'-cf-r53-alias', {
      recordName: cfSiteUrl,
      zone: r53HostedZone,
      target: r53.RecordTarget.fromAlias(new r53Targets.CloudFrontTarget(cfDistribution)),
      comment: 'Portal Site URL',
    });

    // LAMBDA (Pre Token Generation trigger)
    const ptgResourceName = `${awsResourceStem}-pre-token-generation`;

    const cwLogGroupLambda = new logs.LogGroup(this, awsResourceStem+'-cwlg-lambda-ptg', {
      logGroupName: `/aws/lambda/${ptgResourceName}`,
      retention: logs.RetentionDays.ONE_WEEK,
    });
    
    const iamLambdaRole = new iam.Role(this, awsResourceStem+'-iam-role-lambda-ptg', {
      roleName: ptgResourceName,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: `${awsResourceStem}-iam-role-lambda-ptg execution role`,
    });

    const iamLambdaExecPolicyDoc = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          sid: 'AllowCwLogging',
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ],
          resources: [`${cwLogGroupLambda.logGroupArn}:*`],
        }),
      ],
    });

    new iam.Policy(this, awsResourceStem+'-iam-policy-lambda-ptg', {
      policyName: ptgResourceName,
      document: iamLambdaExecPolicyDoc,
      roles: [iamLambdaRole],
    });

    const lambdaFunctionPtg = new lambda.Function(this, awsResourceStem+'-lambda-ptg', {
      functionName: ptgResourceName,
      description: 'Cognito PreTokenGeneration Lambda function',
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 128,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(5),
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '/../src/lambda-ptg')),
      role: iamLambdaRole,
    });

    // COGNITO USER POOL (UP)
    // Note: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-saml-idp.html
    const userPool = new cognito.UserPool(this, awsResourceStem+'-cognito-up', {
      userPoolName: awsResourceStem,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        employee_id: new cognito.StringAttribute({minLen: 1, maxLen: 30, mutable: true}),
        job_title: new cognito.StringAttribute({minLen: 1, maxLen: 30, mutable: true}),
        company_name: new cognito.StringAttribute({minLen: 1, maxLen: 30, mutable: true}),
        groups: new cognito.StringAttribute({minLen: 1, maxLen: 1000, mutable: true}),
      },
      lambdaTriggers: {
        // Note: auto adds required invoke permissions
        preTokenGeneration: lambdaFunctionPtg,
      }
    });

    // ROUTE53 ROOT ALIAS
    let rootR53Alias: any;
    if(cfSiteUrl != r53HostedZoneName) {
      // Note: This is required by Cognito to configure a custom domain.
      rootR53Alias = new r53.ARecord(this, awsResourceStem+'-root-r53-alias', {
        zone: r53HostedZone,
        target: r53.RecordTarget.fromAlias(new r53Targets.CloudFrontTarget(cfDistribution)),
        comment: 'Dummy record to keep Cognito Custom Domain happy :)',
      });
    }

    // COGNITO UP DOMAIN
    const userPoolDomain = userPool.addDomain('domain', {
      customDomain: {
        domainName: cognitoAuthUrl,
        certificate: acmCertificate,
      },
    });

    if(cfSiteUrl != r53HostedZoneName) {
      userPoolDomain.node.addDependency(rootR53Alias);
    } else {
      userPoolDomain.node.addDependency(cfR53Alias);
    }

    // ROUTE53 COGNITO ALIAS
    const cognitoR53Alias = new r53.ARecord(this, awsResourceStem+'-cognito-r53-alias', {
      recordName: cognitoAuthUrl,
      zone: r53HostedZone,
      target: r53.RecordTarget.fromAlias(new r53Targets.UserPoolDomainTarget(userPoolDomain)),
      comment: 'Portal Auth URL',
    });

    // COGNITO UP IDP
    let userPoolClient: any;
    // Note: The 'cognito.UserPoolIdentityProviderSaml' is not natively supported yet
    // Issue: https://github.com/aws/aws-cdk/issues/6853
    if(fs.existsSync(aadSamlFederationMetadataXml)) {
      const userPoolSamlIdp = new cognito.CfnUserPoolIdentityProvider(this, awsResourceStem+'-cognito-saml-idp', {
        userPoolId: userPool.userPoolId,
        providerType: 'SAML',
        providerName: cognitoAadIdpDisplayName,
        providerDetails: {
          MetadataFile: fs.readFileSync(aadSamlFederationMetadataXml).toString(),
        },
        attributeMapping: {
          // default
          'email': 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
          'family_name': 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
          'given_name': 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
          'preferred_username': 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', // upn
          // additional
          'custom:groups': 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
          'custom:employee_id': 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/employeeid',
          'custom:job_title': 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/jobtitle',
          'custom:company_name': 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/companyname',
        },
      });

      // COGNITO UP CLIENT
      userPoolClient = userPool.addClient('client', {
        userPoolClientName: awsResourceStem,
        supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.custom(userPoolSamlIdp.providerName)], // custom
        oAuth: {
          flows: {
            authorizationCodeGrant: true,
          },
          scopes: [
            cognito.OAuthScope.OPENID,
            cognito.OAuthScope.EMAIL,
            cognito.OAuthScope.PROFILE,
          ],
          callbackUrls: [`https://${cfR53Alias.domainName}`],
          logoutUrls: [`https://${cfR53Alias.domainName}`],
        },
      });

      userPoolClient.node.addDependency(userPoolSamlIdp);

      // COGNITO UI CUSTOMIZATION
      // Info: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-ui-customization.html
      // Note: Logo replacement is not supported, it must be uploaded manually.
      if(cognitoUiCustomsEnabled) {
        // TODO: add logic deploying it once the Cognito Custom domain becomes Active
        new cognito.CfnUserPoolUICustomizationAttachment(this, awsResourceStem+'-cognito-ui-css', {
          clientId: userPoolClient.userPoolClientId,
          userPoolId: userPool.userPoolId,
          css: fs.readFileSync(cognitoUiCustomCss).toString(),
        });
      }
    }

    // OUTPUTS
    new cdk.CfnOutput(this, 'frontendS3BucketName', {
      value: frontendS3Bucket.bucketName,
      description: 'The name of the frontend S3 bucket',
      exportName: 'frontendS3BucketName',
    });

    new cdk.CfnOutput(this, 'portalSiteUrl', {
      value: `https://${cfR53Alias.domainName}`,
      description: 'The Portal site URL',
      exportName: 'portalSiteUrl',
    });

    new cdk.CfnOutput(this, 'cognitoUserPoolId', {
      value: userPool.userPoolId,
      description: 'The Cognito UserPool ID',
      exportName: 'cognitoUserPoolId',
    });

    new cdk.CfnOutput(this, 'cognitoDomainName', {
      value: `https://${cognitoR53Alias.domainName}`,
      description: 'The Cognito Domain Name',
      exportName: 'cognitoDomainNameCname',
    });

    if(fs.existsSync(aadSamlFederationMetadataXml)) {
      new cdk.CfnOutput(this, 'cognitoUserPoolClientId', {
        value: userPoolClient.userPoolClientId,
        description: 'The Cognito UserPool Client ID',
        exportName: 'cognitoUserPoolClientId',
      });
    }
  }
}
