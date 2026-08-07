// Single-user auth stub for Mojulo.
// Every request is treated as the same local operator. The user object shape
// matches what the builder/deploy code expects (id + email).

const LOCAL_USER = {
  id: 'local',
  email: 'local@mojulo',
  name: 'Local Operator',
};

export async function getCurrentUser() {
  return LOCAL_USER;
}

export async function requireAuth() {
  return LOCAL_USER;
}
