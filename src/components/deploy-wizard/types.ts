export interface Instance {
  id: string;
  name: string;
  url: string;
  insecureTls: boolean;
  createdAt: string;
}

export interface Stack {
  Id: number;
  Name: string;
  EndpointId: number;
}

export interface CreatedWebhook {
  id: string;
  name: string;
  token: string;
  stackName: string;
  portainerInstanceId: string;
}