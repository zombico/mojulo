"""Numerical contract tests; do not substitute for the visual review."""
import importlib.util
from pathlib import Path
import unittest,json,xml.etree.ElementTree as ET
import numpy as np
spec=importlib.util.spec_from_file_location('wire',Path(__file__).with_name('build-wire.py'))
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
NS='{http://www.w3.org/2000/svg}'
class WireTests(unittest.TestCase):
 def test_source_and_orbit_bounds(self):
  self.assertTrue(np.isfinite(w.V).all())
  self.assertTrue(all(len(f)==3 and all(0<=i<len(w.V) for i in f) for f in w.F))
  for az in np.arange(0,360,7.5):
   q,_=w.project(az)
   self.assertTrue((q[:,2]>0).all())
   self.assertTrue(((q[:,:2]>=0)&(q[:,:2]<=w.W)).all())
 def test_degenerate_occluders_do_not_hide_edges(self):
  tri=np.array([[[0.,0.,1.],[0.,0.,1.],[0.,0.,1.]]])
  self.assertTrue(w.visible_samples(np.array([[2.,2.]]),np.array([2.]),tri)[0])
 def test_occlusion_inside_outside_and_coplanar(self):
  tri=np.array([[[0.,0.,1.],[10.,0.,1.],[0.,10.,1.]]])
  xy=np.array([[2.,2.],[8.,8.],[2.,2.],[2.,2.]])
  self.assertEqual(w.visible_samples(xy,np.array([2.,2.,1.,.5]),tri).tolist(),[False,True,True,True])
 def test_perspective_depth(self):
  tri=np.array([[[0.,0.,1.],[10.,0.,2.],[0.,10.,2.]]])
  # At the screen centroid depth is harmonic (1.5), not arithmetic (1.667).
  self.assertEqual(w.visible_samples(np.array([[10/3,10/3],[10/3,10/3]]),np.array([1.6,1.4]),tri).tolist(),[False,True])
 def test_embedded_source_camera_and_determinism(self):
  before=w.V.copy()
  for az in [0,90,150,180]:
   paths=w.view(az);s=w.svg(paths,az=az)
   self.assertEqual(s,w.svg(w.view(az),az=az))
   root=ET.fromstring(s);metadata={e.get('id'):json.loads(e.text) for e in root.findall(NS+'metadata')}
   self.assertEqual(metadata['spatial-source'],w.D);self.assertEqual(metadata['projection']['azimuthDegrees'],az)
   ids=[e.get('id') for e in root.findall(NS+'path')];self.assertEqual(len(ids),len(set(ids)))
  np.testing.assert_array_equal(w.V,before)
 def test_clipped_runs_reproject_from_spatial_edge(self):
  for az in [0,90,150,180]:
   q,pos=w.project(az)
   for p in w.view(az):
    a,b=p['edge']
    for t,xy in zip(p['xyzT'],p['xy']):
     # Projective interpolation of the original 3D edge.
     depth=(1-t)*q[a,2]+t*q[b,2]
     projected=((1-t)*q[a,:2]*q[a,2]+t*q[b,:2]*q[b,2])/depth
     np.testing.assert_allclose(projected,xy,atol=1e-8)
     self.assertTrue(0<=t<=1)
if __name__=='__main__':unittest.main()
