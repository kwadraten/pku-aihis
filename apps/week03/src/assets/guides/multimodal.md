# 三种路线、三种不同的输入

D30：对原页的 OCR 和人工版面描述进行字面检索。人工描述在数据中标注 caption_origin；本次未调用视觉语言模型生成描述。若按助教阿里云方案接入视觉模型，保存模型名、提示词与原响应，另列 caption_model 字段；不能用人工描述冒充其输出。

D31：真实 CLIP 图文共同空间。Xenova/clip-vit-base-patch32，修订 d15189d7028b43f1d3e65039190477f6af591c2a，q8，Transformers.js 3.8.1，512维，标准AutoProcessor和L2归一化。7张原页区域图片、4条英文提示均已在本机编码。页面显示中文释义及数据中的英文实际输入；不宣称中文自由文本已运行。黄色标注、横竖排等版面问题与宗教内容问题并列，用于观察模型失败。

D32：沿用助教 kuzushi-classifier-app 的模型路线，使用 kwadraten/shikiji 修订84cc2fbec1603cd72daaf1c2814a65b977636b5c 的 embedding ONNX；ConvNeXt Tiny池化输出768维。输入RGB、双线性缩放160×160、float32/255、不作均值方差归一化；输出L2归一化。网页实时计算余弦近邻，排除查询图块自身。

样本来自模型训练源清单中的 kwadraten/hi-utokyo-kuzushi（東京大学史料編纂所くずし字データ），train在0、1000、10000、50000、100000、180000、250000、320000处各取6项，共48项，保留字符标签与行号。数据卡声明CC BY 4.0。此样本只演示近邻，不是独立模型测试集；训练集上的邻近不能当作准确率。助教原COS整库地址本次无法连通，因此从同一上游来源取得小样本，未声称复制其整库。

来源：
- https://github.com/kwadraten/kuzushi-classifier-app
- https://huggingface.co/kwadraten/shikiji
- https://huggingface.co/datasets/kwadraten/hi-utokyo-kuzushi
- https://huggingface.co/Xenova/clip-vit-base-patch32

模型权重不在公开仓库；下载和推理脚本见仓库 local/ 下的预计算说明。任一模型更换时，查询和文档/图片向量必须一起重算。
