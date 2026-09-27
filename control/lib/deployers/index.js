import { DockerDeployer } from './docker.js';

let _deployer = null;

export async function getDeploymentProvider() {
  if (!_deployer) _deployer = new DockerDeployer();
  return _deployer;
}

export async function deploy(params) {
  const provider = await getDeploymentProvider();
  return provider.deploy(params);
}

export async function destroy(appId) {
  const provider = await getDeploymentProvider();
  return provider.destroy(appId);
}

// Cloud deployers are built per call from the saved, encrypted token
// (lib/deployers/cloud-deploy.js buildProviderDeployer). Add new providers there.
export const CLOUD_PROVIDERS = ['fly'];
