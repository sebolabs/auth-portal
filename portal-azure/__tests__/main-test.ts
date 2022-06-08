import "cdktf/lib/testing/adapters/jest";
import { Testing } from "cdktf";
import { PortalStack } from "../main";
// import { Application } from "@cdktf/provider-azuread";

// More info: https://cdk.tf/testing

describe("Terraform", () => {
  it("check if the produced terraform configuration is valid", () => {
    const app = Testing.app();
    const stack = new PortalStack(app, "test");
    expect(Testing.fullSynth(stack)).toBeValidTerraform();
  });

  it.todo("check if this can be planned");
  // it("check if the produced terraform configuration is valid", () => {
  //   const app = Testing.app();
  //   const stack = new PortalStack(app, "test");
  //   expect(Testing.fullSynth(stack)).toPlanSuccessfully();
  // });
});

describe("AzureAD configuration", () => {
  it.todo("should contain an application");
  // it("should contain an application", () => {
  //   expect(
  //     Testing.synthScope((scope) => {
  //       new PortalStack(scope, 'test');
  //     })
  //   ).toHaveResource(Application);
  // });

  it.todo("should contain a service principal");
  it.todo("should contain a claims mapping policy");
  it.todo("should contain a service principal claims mapping policy assignment");
});

