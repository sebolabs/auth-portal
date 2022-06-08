import { Construct } from "constructs";
import { Utils } from "./utilities";
import * as fs from 'fs';
import {
  App,
  TerraformStack,
  TerraformOutput,
  RemoteBackend,
} from "cdktf";
import {
  AzureadProvider,
  ApplicationFeatureTags,
  Application,
  ServicePrincipalFeatureTags,
  ServicePrincipal,
  ClaimsMappingPolicy,
  ServicePrincipalClaimsMappingPolicyAssignment,
  Group,
} from "./.gen/providers/azuread";

const project = process.env.PROJECT;
const env = process.env.ENV;

export class PortalStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AzureadProvider(this, "AzureAd", {});

    this.AzureAdSamlApp();
  }

  AzureAdSamlApp(this: PortalStack) {
    const azureResourceStem = process.env.AZURE_STEM || `${Utils.Capitalize(project)}${Utils.Capitalize(env)}Portal`;
    const awsCognitoUpId = process.env.AWS_COGNITO_UP_ID;
    const samlIdUri = `urn:amazon:cognito:sp:${awsCognitoUpId}`;
    const samlReplyUrl = process.env.SAML_REPLY_URL; // ends with /saml2/idpresponse
    const samlRelayState = process.env.SAML_RELAY_STATE;
    const samlLogoutUrl = process.env.SAML_LOGOUT_URL;
    const samlNotificationEmail = process.env.SAML_NOTIFY_EMAIL;

    const samlClaimsMappingJson = `{
      "ClaimsMappingPolicy": {
        "IncludeBasicClaimSet": "true",
        "Version": 1,
        "ClaimsSchema": [
          {
            "SamlClaimType": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
            "Source": "user",
            "ID": "mail"
          },
          {
            "SamlClaimType": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
            "Source": "user",
            "ID": "givenname"
          },
          {
            "SamlClaimType": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
            "Source": "user",
            "ID": "surname"
          },
          {
            "SamlClaimType": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
            "Source": "user",
            "ID": "userprincipalname"
          },
          {
            "SamlClaimType": "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups",
            "Source": "user",
            "ID": "groups"
          },
          {
            "SamlClaimType": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/employeeid",
            "Source": "user",
            "ID": "employeeid"
          },
          {
            "SamlClaimType": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/jobtitle",
            "Source": "user",
            "ID": "jobtitle"
          },
          {
            "SamlClaimType": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/companyname",
            "Source": "user",
            "ID": "companyname"
          }
        ]
      }
    }`

    // APPLICATION
    const appFeatureTags: ApplicationFeatureTags = {
      enterprise: true,
    };

    const app = new Application(this, "portal_app", {
      displayName: `SeboLabs ${Utils.Capitalize(env)} Portal`,
      logoImage: fs.readFileSync('./files/logo.png', {encoding: 'base64'}),
      featureTags: [appFeatureTags],
      identifierUris: [samlIdUri],
      web: {
        redirectUris: [samlReplyUrl],
        logoutUrl: samlLogoutUrl,
      },
      preventDuplicateNames: true,
      // Note: https://docs.microsoft.com/en-us/azure/active-directory/hybrid/how-to-connect-fed-group-claims
      groupMembershipClaims: ["SecurityGroup"],
      optionalClaims: {
        saml2Token: [{
          name: "groups",
          essential: false,
          additionalProperties: ["sam_account_name"],
        }],
      },
      owners: [],
    });

    // SERVICE PRINCIPAL
    const spFeatureTags: ServicePrincipalFeatureTags = {
      enterprise: true,
      customSingleSignOn: true,
    }

    const servicePrincipal = new ServicePrincipal(this, "portal_sp", {
      applicationId: app.applicationId,
      featureTags: [spFeatureTags],
      preferredSingleSignOnMode: "saml",
      samlSingleSignOn: {
        relayState: samlRelayState,
      },
      notificationEmailAddresses: [samlNotificationEmail],
    });

    const claimsMappingPolicy = new ClaimsMappingPolicy(this, "portal_cmp", {
      displayName: `${azureResourceStem}Claims`,
      definition: [samlClaimsMappingJson],
    });

    new ServicePrincipalClaimsMappingPolicyAssignment(this, "portal_cmpa", {
      servicePrincipalId: servicePrincipal.id,
      claimsMappingPolicyId: claimsMappingPolicy.id,
    });

    // Note: SAML Signing Certificate creation out of scope here
    //       Instead, create manually from within the Azure EA console.

    // SECURITY GROUP
    const portalUserGroup = new Group(this, "portal_users", {
      displayName: `${azureResourceStem}Users`,
      description: `The users group allowing access to ${azureResourceStem}`,
      securityEnabled: true,
      provisioningOptions: [],
      behaviors: [],
      types: [],
    });

    // OUTPUTS
    new TerraformOutput(this, "app_id", {
      value: app.applicationId,
      description: "The AAD application ID",
    });

    new TerraformOutput(this, "app_access_users_group", {
      value: portalUserGroup.displayName,
      description: "The Portal users group name",
    });
  }
}

const app = new App();
const stack = new PortalStack(app, "sebolabs-aad-auth-portal");
new RemoteBackend(stack, {
  hostname: "app.terraform.io",
  organization: "SeboLabs",
  workspaces: {
    name: `${project}-${env}-portal`,
  }
});
app.synth();
