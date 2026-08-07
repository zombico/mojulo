import { describe, expect, it } from 'vitest';

import { projectOperatorWorld, assembleOperatorWorldScene } from './operator-world.js';

// A minimal Connected Services union list, shaped like loader.listConnectedServices().services.
const services = [
  {
    ref: 'skill_abc',
    kind: 'skill',
    name: 'CRM digest',
    calls: [{ server: 'gmail', present: true }, { server: 'notion', present: false }],
    needs: [{ capability: 'crm', label: 'a CRM' }],
  },
  {
    ref: 'comp_xyz',
    kind: 'mcp_solution',
    name: 'Lead router',
    calls: [{ server: 'gmail', present: true }],
    needs: [],
  },
];

describe('projectOperatorWorld', () => {
  it('makes one service node per service and one mcp node per distinct target', () => {
    const { nodes } = projectOperatorWorld(services);
    const svc = nodes.filter((n) => n.type === 'service');
    const mcp = nodes.filter((n) => n.type === 'mcp');
    expect(svc.map((n) => n.id)).toEqual(['svc:skill_abc', 'svc:comp_xyz']);
    // gmail (shared, dedup'd), notion, and the `crm` need — three distinct targets.
    expect(mcp.map((n) => n.id).sort()).toEqual(['mcp:need:crm', 'mcp:srv:gmail', 'mcp:srv:notion']);
  });

  it('marks a server present if ANY call wires it, and needs are always gaps', () => {
    const { nodes } = projectOperatorWorld(services);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    expect(byId['mcp:srv:gmail'].present).toBe(true);
    expect(byId['mcp:srv:notion'].present).toBe(false);
    expect(byId['mcp:need:crm'].present).toBe(false);
  });

  it('lays services on the front row and mcp targets on the back row, centred on x=0', () => {
    const { nodes } = projectOperatorWorld(services);
    const svc = nodes.filter((n) => n.type === 'service');
    const mcp = nodes.filter((n) => n.type === 'mcp');
    expect(svc.every((n) => n.at[1] < 0)).toBe(true);
    expect(mcp.every((n) => n.at[1] > 0)).toBe(true);
    // two services centred → symmetric about 0
    expect(svc[0].at[0]).toBe(-svc[1].at[0]);
  });

  it('emits an edge per call plus a dangling edge per need, wiring flags carried through', () => {
    const { edges } = projectOperatorWorld(services);
    expect(edges).toContainEqual({ from: 'svc:skill_abc', to: 'mcp:srv:gmail', present: true });
    expect(edges).toContainEqual({ from: 'svc:skill_abc', to: 'mcp:srv:notion', present: false });
    expect(edges).toContainEqual({ from: 'svc:skill_abc', to: 'mcp:need:crm', present: false });
    expect(edges).toContainEqual({ from: 'svc:comp_xyz', to: 'mcp:srv:gmail', present: true });
    expect(edges.length).toBe(4);
  });

  it('is deterministic — same list → identical projection', () => {
    expect(projectOperatorWorld(services)).toEqual(projectOperatorWorld(services));
  });

  it('handles an empty state without throwing', () => {
    expect(projectOperatorWorld([])).toEqual({ nodes: [], edges: [] });
  });
});

describe('assembleOperatorWorldScene', () => {
  it('turns a projected graph into a walkable faces payload', () => {
    const manifest = { kind: 'operator-world', ...projectOperatorWorld(services) };
    const payload = assembleOperatorWorldScene(manifest, {});
    expect(payload.walk).toBe(true);
    expect(Array.isArray(payload.faces)).toBe(true);
    // ground checker + edge ribbons + block faces (5 per block).
    expect(payload.faces.length).toBeGreaterThan(manifest.nodes.length * 5);
    expect(payload.cameras[0].worldFraming).toBeTruthy();
    // every corner is a 3-tuple (z-up world geometry).
    expect(payload.faces.every((f) => f.corners.every((c) => c.length === 3))).toBe(true);
  });

  it('renders a bare floor for an empty state (no nodes)', () => {
    const payload = assembleOperatorWorldScene({ kind: 'operator-world', nodes: [], edges: [] }, {});
    expect(payload.faces.length).toBeGreaterThan(0); // ground only
  });
});
