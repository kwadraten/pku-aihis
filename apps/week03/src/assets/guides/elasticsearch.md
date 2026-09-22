# Elasticsearch 本地实践

来源：https://github.com/elastic/elasticsearch

常驻服务负责字段分析、倒排索引和查询；网页可以查看请求与结果。

适用范围：需Docker或官方服务安装；两个产品配置分别核验。本次不把请求示例当已运行响应。

## 本机服务

使用仅绑定回环地址的教学单节点；生产部署另行配置认证和资源。

```text
docker run --rm -p 127.0.0.1:9200:9200 -e discovery.type=single-node -e xpack.security.enabled=false -e "ES_JAVA_OPTS=-Xms1g -Xmx1g" docker.elastic.co/elasticsearch/elasticsearch:8.19.0
```

观察：容器版本与端口；服务未启动时不显示成功。

## 分析词项

先查看选定分析器怎样切分正文；旧字转换另建检索字段。

```text
POST /_analyze
{"analyzer":"standard","text":"宗教と國民道德"}
```

观察：返回词项与位置；对中日文应据需要配置分析器。

## 写入与查询

创建字段模式、写入带页码文档，再刷新可见索引。

```text
PUT /week03
{"mappings":{"properties":{"body":{"type":"text"},"source_id":{"type":"keyword"},"pdf_page":{"type":"integer"}}}}
PUT /week03/_doc/1?refresh=true
{"body":"此处写入已核对片段","source_id":"JP16","pdf_page":12}
GET /week03/_search
{"query":{"match":{"body":"宗教"}},"explain":true}
```

观察：占位请求需由实际片段替换。explain解释计分，不证明史料可信。

## 运行与验证口径

网页步骤展示不是执行日志。仅在页面明确出现带版本和时间的运行结果时记为实跑。服务型工具在本地启动，GitHub Pages只提供前端。真实语料使用同一份带页码记录的JSON；模型及向量配置须兼容。完整OCR保留本机。
