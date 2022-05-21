---
title: 新年前爬个明日方舟的立绘
categories:
  - 爬虫试水
tags:
  - Python
top_img: https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/ark.png
# cover: https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/ark.png
description: 元旦前一天爬一爬
abbrlink: 53760
date: 2020-12-31 00:00:00
updated: 2021-01-03 19:45:00
---
新年前随手写的爬虫，2021新年快乐呀！

--------

今天有个朋友跟我说，他想爬一下明日方舟的人物立绘

虽然没玩过明日方舟，但自己也去看了看图，好家伙，画得针不戳

emmm，那我试着爬一爬吧

**（本代码太水所以就不挂 GitHub 了啦,代码在下面）**

--------

先看看朋友给的图片的链接：`http://prts.wiki/images/6/65/%E7%AB%8B%E7%BB%98_%E5%87%AF%E5%B0%94%E5%B8%8C_2.png`

按照这格式，我觉得只能访问主站了…… [http://prts.wiki](http://prts.wiki)

主站长这样~~（玩方舟的小伙伴别吐槽我）~~

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20201230232636.png)

然后我在左侧菜单里面翻找了半天（啊啊啊，立绘在哪里啊！！！）

<img src="https://cdn1.tianli0.top/gh/NotFoundNEKKO/BQBTwT@1.0/真叫人质壁分离.jpg" width="300" height="300">

。。。我眼瞎，右上角大大的搜索框我看不见。。。

--------

搜索立绘，然后选了选范围为多媒体，然后最下面把单页最大显示数量调成500

唉，刚好一页（我不用从好多页网页爬图了，开心！）

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20201230233429.png)

现在就得开始爬图了

-------

F12 看一下网页源代码

蒽？这个链接貌似有点不对

给的是 `/images/thumb/6/65/%E7%AB%8B%E7%BB%98_%E5%87%AF%E5%B0%94%E5%B8%8C_2.png` ，我要的是这个 `http://prts.wiki/images/6/65/%E7%AB%8B%E7%BB%98_%E5%87%AF%E5%B0%94%E5%B8%8C_2.png` 嘛！

比对一下，后面的都一样（那后期字符串剪一剪就差不多啦）

-------

因为之前也爬过图片，所以自己感觉总体来说难度不大（我发现我还是比较善于用字符串find）

我就直接上代码了

```python
import os
from bs4 import BeautifulSoup
import time
import requests

url = "http://prts.wiki/index.php?title=%E7%89%B9%E6%AE%8A:%E6%90%9C%E7%B4%A2&limit=500&offset=0&profile=images&search=%E7%AB%8B%E7%BB%98"

headers = {
    "Cookie": "arccount62298=c; arccount62019=c",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 Edg/87.0.664.66"
}

html = requests.get(url, headers=headers)
html.encoding = html.apparent_encoding
soup = BeautifulSoup(html.text, "html.parser")

list = soup.find_all(class_ = "searchResultImage")

try:
    os.mkdir("./Arknights")  ##  创建文件夹
except:
    pass

os.chdir("./Arknights")
num=0

for s in list:
    string = str(s)

    namebegin = string.find('title="文件')
    nameend = string[namebegin:].find('png')

    name = string[namebegin+10:namebegin+nameend+3]
    name = name.replace(" ","_")

    urlbegin = string.find('data-src="/images/thumb/')
    urlend = string[urlbegin:].find('png')

    imgurl = 'http://prts.wiki/images/' + string[urlbegin+24:urlbegin+urlend+3]

    img = requests.get(imgurl, headers=headers).content
    with open(name, 'wb') as f:
        f.write(img)
        num+=1
        print("已爬取{}张,图片名称为：{}，链接为：{}".format(num,name,imgurl))
    time.sleep(1)

```

代码不长，但因为不太会 [BeautifulSoup](https://beautifulsoup.readthedocs.io/zh_CN/v4.4.0/#) 而走了不少弯路。不过最终还是爬完了所有立绘

最后结果如下

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20201230234602.png)

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20201230234715.png)

--------

> 那位小伙伴说有重复，而且想做分类

然后他自己写了半天，然后我看不下去了。。。

然后也做了分类去重（我就稍微多了几行。。。）

代码这里就不放了，小伙伴的博客文章里有我原先那个代码的注释版~~（注释多的有点惨不忍睹）~~

以及我修改后的代码也在他的文章的最下边[点我右转！](https://heart-of-engine.github.io/posts/fccf.html)

最后再次祝看到这篇博客的小伙伴：

## 2021，新年快乐鸭！

