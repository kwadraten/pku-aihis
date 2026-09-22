import sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import model_backend as m
class BackendTests(unittest.TestCase):
 def test_endpoint_rejects_credential_urls(self):
  for u in ['http://evil.example/v1','https://key@api.example/v1','https://api.example/v1?key=x','file:///tmp/key']:
   with self.assertRaises(ValueError):m.endpoint(u)
  self.assertEqual(m.endpoint('https://api.deepseek.com/'),'https://api.deepseek.com/chat/completions')
 def test_parameter_ceiling_is_total_not_active(self):
  with patch.object(m,'request_json',return_value={'model_info':{'general.parameter_count':27_000_000_000},'details':{'parameter_size':'27B'}}):
   with self.assertRaisesRegex(ValueError,'10B'):m.model_info('large-moe')
 def test_picture_requires_embedded_data(self):
  with self.assertRaises(ValueError):m.ollama_messages([{'role':'user','content':[{'type':'image_url','image_url':{'url':'http://private-host/image'}}]}])
  self.assertEqual(m.ollama_messages([{'role':'user','content':[{'type':'text','text':'A'},{'type':'image_url','image_url':{'url':'data:image/jpeg;base64,AA=='}}]}]),[{'role':'user','content':'A','images':['AA==']}])
 def test_api_response_has_no_key(self):
  request={'provider':'openai','base_url':'https://api.example/v1','api_key':'test-only-secret','model':'m','messages':[{'role':'user','content':'A'}]}
  with patch.object(m,'request_json',return_value={'id':'run1','model':'returned-version','choices':[{'message':{'content':'answer'},'finish_reason':'stop'}]}):
   result=m.completion(request)
  self.assertNotIn('test-only-secret',str(result));self.assertEqual(result['model'],'returned-version')
 def test_missing_content_is_failure(self):
  with patch.object(m,'request_json',return_value={'choices':[{'message':{'content':''},'finish_reason':'length'}]}):
   with self.assertRaises(RuntimeError):m.completion({'provider':'openai','base_url':'https://api.example','model':'m','messages':[{'role':'user','content':'A'}]})
if __name__=='__main__':unittest.main()
