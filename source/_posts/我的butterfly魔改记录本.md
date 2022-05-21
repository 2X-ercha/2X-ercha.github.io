---
title: '个人哔哔: 我的butterfly魔改记录'
categories: 贰猹随笔
writeByhand: true
tags:
  - Diary
  - Course
description: 一如魔改深似海，一直魔改一直耍
top_img: https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/deemo_for_cover/18.jpg
cover: https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/deemo_for_cover/18.jpg
abbrlink: 10567
date: 2021-02-20 20:43:07
---
其实butterfly确实是hexo主题里为数不多的<b style="color:red">优雅</b><del>（花里胡哨）</del>的主题了

但看了[@冰卡诺老师](https://zfe.space/)和[@Aki店长](https://akilar.top/)的博客后，十分感慨：<b style="color:cyan">人与人的butterfly不能一概而论</b>

所以，学习<del>（白嫖）</del>着他们的教程，我也开始走上魔改bf之路

--------

> 但店长说的好：<b style="color:cyan">魔改一时爽，升级火葬场</b>

记录魔改历程也是为了以后主题更新能找到回家的路（毕竟主题更新相当于把大部分魔改推倒重来）

所以也记录和备份我修改/添加过的文件，方便查询（不含标签外挂）

```
root
├─source
│   ├─_data
│   │   └─slider.yml
└─themes
    └─butterfly
        ├─layout
        │   ├─includes
        │   │   ├─post
        │   │   │   └─post-copyright.pug
        │   │   ├─page
        │   │   │   └─flink.pug
        │   ├─index.pug
        │   └─sliderbar.pug
        └─source
            ├─css
            │   ├─_layout
            │   │   ├─categoryBar.styl
            │   │   ├─swiperstyle.styl
            │   │   └─post.styl
            │   ├─_page
            │   │   └─flink.styl
            │   ├─commentsbar.css
            │   ├─index.styl
            │   ├─moments.css
            │   └─add.css
            └─js
                ├─swiper_init.js
                ├─moments.js
                └─kernel.js

```

--------

# 主题源码修改部分

## 留言板动态弹出信封样式

> 参考教程：店长的[Envelope Style Comments Bar](https://akilar.top/posts/e2d3c450/)

新增的主题源码：  
`[root]\themes\butterfly\source\css\commentsbar.css`

--------

## 友链样式魔改

> 参考教程：店长的[Friend Link Card Beautify](https://akilar.top/posts/57291286/)

修改的主题源码：  
`[root]\themes\butterfly\layout\includes\page\flink.pug`  
`[root]\themes\butterfly\source\css\_page\flink.styl`

--------

## 首页磁贴

> 参考教程：店长的[Categories Magnet](https://akilar.top/posts/a9131002/)

修改的主题源码：  
`[root]\themes\butterfly\layout\index.pug`

新增的主题源码：  
`[root]\themes\butterfly\source\css\_layout\categoryBar.styl`

-------

## 首页置顶轮播图

> 参考教程：店长的[Slider Bar](https://akilar.top/posts/8e1264d1/)

新增的主题源码：  
`[root]\themes\butterfly\layout\includes\sliderbar.pug`  
`[root]\themes\butterfly\source\js\swiper_init.js`  
`[root]\themes\butterfly\source\css\_layout\swiperstyle.styl`

修改的主题源码：  
`[root]\themes\butterfly\source\css\index.styl`

新增配置文件：  
`[root]\source\_data\slider.yml`

--------

## 版权信息美化

> 参考教程：Nesxc的[butterfly版权美化教程](https://www.nesxc.com/post/hexocc.html)

修改的主题源码：  
`[root]\themes\butterfly\layout\includes\post\post-copyright.pug`  
`[root]\themes\butterfly\source\css\_layout\post.styl`

--------

## 拒绝IE,从我做起

> 参考教程: Nesxc的[Butterfly检测IE内核跳转教程](https://www.nesxc.com/post/noie.html)

新增的主题源码：  
`[root]\themes\butterfly\source\js\kernel.js`
`[root]\themes\butterfly\source\kernel.html`

--------

## 友链朋友圈样式调整

> 如果想整友链朋友圈，参考教程：冰老师的[基于 hexo 的友链朋友圈 Beta1.5](https://zfe.space/post/friend-link-circle.html)

以下是我自己的修改(其实那个css可以整进js里的，只不过懒得一个个去调，干脆自己引入了)

新增的主题源码:
`[root]\themes\butterfly\source\js\moments.js`
`[root]\themes\butterfly\source\css\moments.css`

js源码修改（做了重新布局，冰老师的UI好丑）：
```JS
var requests_url = 'https://hexo-circle-of-friends-api-2x-ercha.vercel.app/api'; //api地址
var orign_data = []; //api请求所得到的源数据
var maxnumber = 20; //页面展示文章数量
var addnumber = 10; //每次加载增加的篇数
var opentype = '_blank';  //'_blank'打开新标签,'_self'本窗口打开
var nofollow = true; //禁止搜索引擎抓取
// 自定义loading图 例如: var loadingCutom = '<i class="fa fa-spinner fa-spin"></i>'
// 自定义loading图 例如: var loadingCutom = '<img src="你的图片地址" alt="加载中...">'
var loadingCutom = ''

//处理数据

if(document.getElementById('moments_container')){
  //添加加载动画
  var loading_pic = document.getElementById('moments_container');
  
  // 判断loadingCutom值是否为空
  if(typeof loadingCutom == "undefined" || loadingCutom == null || loadingCutom === "") {
    loading_pic.innerHTML = '<style>.loader { color: #d9dad8; font-size: 90px; text-indent: -9999em; overflow: hidden; width: 1em; height: 1em; border-radius: 50%; margin: 72px auto; position: relative; -webkit-transform: translateZ(0); -ms-transform: translateZ(0); transform: translateZ(0); -webkit-animation: load6 1.7s infinite ease, round 1.7s infinite ease; animation: load6 1.7s infinite ease, round 1.7s infinite ease; } @-webkit-keyframes load6 { 0% { box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em; } 5%, 95% { box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em; } 10%, 59% { box-shadow: 0 -0.83em 0 -0.4em, -0.087em -0.825em 0 -0.42em, -0.173em -0.812em 0 -0.44em, -0.256em -0.789em 0 -0.46em, -0.297em -0.775em 0 -0.477em; } 20% { box-shadow: 0 -0.83em 0 -0.4em, -0.338em -0.758em 0 -0.42em, -0.555em -0.617em 0 -0.44em, -0.671em -0.488em 0 -0.46em, -0.749em -0.34em 0 -0.477em; } 38% { box-shadow: 0 -0.83em 0 -0.4em, -0.377em -0.74em 0 -0.42em, -0.645em -0.522em 0 -0.44em, -0.775em -0.297em 0 -0.46em, -0.82em -0.09em 0 -0.477em; } 100% { box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em; } } @keyframes load6 { 0% { box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em; } 5%, 95% { box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em; } 10%, 59% { box-shadow: 0 -0.83em 0 -0.4em, -0.087em -0.825em 0 -0.42em, -0.173em -0.812em 0 -0.44em, -0.256em -0.789em 0 -0.46em, -0.297em -0.775em 0 -0.477em; } 20% { box-shadow: 0 -0.83em 0 -0.4em, -0.338em -0.758em 0 -0.42em, -0.555em -0.617em 0 -0.44em, -0.671em -0.488em 0 -0.46em, -0.749em -0.34em 0 -0.477em; } 38% { box-shadow: 0 -0.83em 0 -0.4em, -0.377em -0.74em 0 -0.42em, -0.645em -0.522em 0 -0.44em, -0.775em -0.297em 0 -0.46em, -0.82em -0.09em 0 -0.477em; } 100% { box-shadow: 0 -0.83em 0 -0.4em, 0 -0.83em 0 -0.42em, 0 -0.83em 0 -0.44em, 0 -0.83em 0 -0.46em, 0 -0.83em 0 -0.477em; } } @-webkit-keyframes round { 0% { -webkit-transform: rotate(0deg); transform: rotate(0deg); } 100% { -webkit-transform: rotate(360deg); transform: rotate(360deg); } } @keyframes round { 0% { -webkit-transform: rotate(0deg); transform: rotate(0deg); } 100% { -webkit-transform: rotate(360deg); transform: rotate(360deg); } }</style><center><span id="moments_loading"><div class="loader"></div></span></center>';
  } else {
    loading_pic.innerHTML = '<center><span id="moments_loading">'+loadingCutom+'</span></center>';
  }

  fetch(requests_url).then(
      data => data.json()
  ).then(
      data => {
        orign_data = data;
        data_handle(nofollow,orign_data, maxnumber)
      }
  )}

var data_handle = (nofollow,data, maxnumber) => {
  var today = todaypost();
  var Datetody = new Date(today);
  for (var item = 0; item < data[1].length; item++) {
    var Datedate = new Date(data[1][item][1]);
    if (Datedate > Datetody) {
      data[1].splice(item--, 1);
    }
  }
  var today_post = 0;
  var error = 0;
  var unique_live_link;
  var datalist = data[1].slice(0, maxnumber);
  var listlenth = data[1].length;
  var user_lenth = data[0].length;
  var datalist_slice = slice_month(datalist);
  var last_update_time = timezoon(datalist_slice);
  var link_list = [];
  for (var item of data[1]) {
    if (item[1] === today) {
      today_post += 1;
    }
    link_list.push(item[3]);
  }
  var arr = unique(link_list);
  unique_live_link = arr.length;
  for (var item of data[0]) {
    if (item[3] === 'true') {
      error += 1;
    }
  }
  var html_item = '<h2>统计信息</h2>';
  html_item += '<div id="info_user_pool" class="moments-item info_user_pool" style="">';
  html_item += '<div class="moments_chart"><span class="moments_post_info_title">当前友链数：</span><span class="moments_post_info_number">' + user_lenth + ' 个</span><br><span class="moments_post_info_title">失败数：</span><span class="moments_post_info_number">' + error + ' 个</span><br></div>';
  html_item += '<div class="moments_chart"><span class="moments_post_info_title">活跃友链数：</span><span class="moments_post_info_number">' + unique_live_link + ' 个</span><br><span class="moments_post_info_title">当前库存：</span><span class="moments_post_info_number">' + listlenth + ' 篇</span><br></div>';
  html_item += '<div class="moments_chart"><span class="moments_post_info_title">今日更新：</span><span class="moments_post_info_number">' + today_post + ' 篇</span><br><span class="moments_post_info_title">最近更新：</span><span class="moments_post_info_number">' + last_update_time + '</span><br></div>';
  html_item += '</div>';

  for (var month_item of datalist_slice) {
    html_item += '<h2>' + month_item[0] + '</h2>';
    for (var post_item of month_item[1]) {
      var rel = '';
      if (nofollow && opentype == '_blank'){
        rel = 'noopener nofollow';
      }else if(nofollow){
        rel = 'nofollow';
      }else if(opentype == '_blank'){
        rel = 'noopener';
      }else{
        rel = '';
      }
      html_item += ' <div class="moments-item">';
        
        //左侧头像
        html_item += ' <a target="' + opentype + '" class="moments-item-img" href="' + post_item[2] + '" title="' + post_item[0] + '"rel="'+ rel + '">';
        html_item += '<img onerror="this.onerror=null,this.src=&quot;https://cdn1.tianli0.top/gh/Zfour/Butterfly-friend-poor-html/friendcircle/404.png&quot;"';
        html_item += ' src="' + post_item[4] + '"></a>';
        //右侧文章信息
        html_item += '<div class="moments-item-info">';
          //文章名
          html_item += `<a target="${opentype}" class="moments-item-title" href="${post_item[2]}" title="${post_item[0]}"rel="${rel}">${post_item[0]}</a>`;
          
          html_item += '<div class="moments-item-time">';
            //文章作者
            html_item += '<span>' + post_item[3] + '</span>';
            //文章时间
            html_item += '<time class="moments_post_time" datetime="' + post_item[1] + '" title="' + post_item[1] + '">' + post_item[1] + '</time>';
          html_item += '</div>'

        html_item += '</div>'
      
      html_item += '</div>';

    }
  }
  if (data[1].length - maxnumber > 0) {
    html_item += '<div style="text-align: center"><button type="button" class="moments_load_button" ' +
        'onclick="load_more_post()">加载更多...</button>' +
        '</div>'
  }
  html_item += '<style>.moments-item-info span{padding-left:.3rem;padding-right:.3rem}.moments_post_time time{padding-left:.3rem;cursor:default}.moments_post_info_title{font-weight:700}.moments_post_info_number{float:right}.moments_chart{align-items:flex-start;flex:1;width:100px;height:60px;margin:20px}@media screen and (max-width:500px){.info_user_pool{padding:10px;flex-direction:column;max-height:200px}.moments_chart{flex:0;width:100%;height:160px;margin:0}}.moments-item:before{border:0}@media screen and (min-width:500px){.moments_post_time{float:right}}.moments_load_button{-webkit-transition-duration:.4s;transition-duration:.4s;text-align:center;border:1px solid #ededed;border-radius:.3em;display:inline-block;background:transparent;color:#555;padding:.5em 1.25em}.moments_load_button:hover{color:#3090e4;border-color:#3090e4}.moments-item{position:relative;display:-webkit-box;display:-moz-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-box-align:center;-moz-box-align:center;-o-box-align:center;-ms-flex-align:center;-webkit-align-items:center;align-items:center;margin:0 0 1rem .5rem;-webkit-transition:all .2s ease-in-out;-moz-transition:all .2s ease-in-out;-o-transition:all .2s ease-in-out;-ms-transition:all .2s ease-in-out;transition:all .2s ease-in-out;box-shadow:rgba(0,0,0,0.07) 0 2px 2px 0,rgba(0,0,0,0.1) 0 1px 5px 0;border-radius:2px}.moments-item-img{overflow:hidden;width:80px;height:80px}.moments-item-img img{max-width:100%;width:100%;height:100%;object-fit:cover}.moments-item-info{-webkit-box-flex:1;-moz-box-flex:1;-o-box-flex:1;box-flex:1;-webkit-flex:1;-ms-flex:1;flex:1;padding:0 .8rem}.moments-item-title{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;font-size:1.1em;-webkit-transition:all .3s;-moz-transition:all .3s;-o-transition:all .3s;-ms-transition:all .3s;transition:all .3s;-webkit-line-clamp:1}</style>'



  var moments_container = document.getElementById('moments_container') ;
  append_div(moments_container, html_item)
};

var load_more_post = () => {
  if(document.getElementById('moments_container')){
    maxnumber = maxnumber + addnumber;
    document.getElementById('moments_container') .innerHTML = "";
    data_handle(nofollow,orign_data, maxnumber)}
};



//加载更多文章
//将html放入指定id的div容器
var append_div = (parent, text) => {
  if(document.getElementById('moments_container')){
    loading_pic.innerHTML = ``;
  };
  if (typeof text === 'string') {
    var temp = document.createElement('div');
    temp.innerHTML = text;
    // 防止元素太多 进行提速
    var frag = document.createDocumentFragment();
    while (temp.firstChild) {
      frag.appendChild(temp.firstChild);
    }
    parent.appendChild(frag);
  } else {
    parent.appendChild(text);
  }
};

//去重
var unique = (arr) => {
  return Array.from(new Set(arr))
};

//时区优化
var formatDate = (strDate) => {
  try {
    var date = new Date(Date.parse(strDate.replace(/-/g, "/")));
    var gettimeoffset;
    if (new Date().getTimezoneOffset()) {
      gettimeoffset = new Date().getTimezoneOffset();
    } else {
      gettimeoffset = 8;
    }
    var timeoffset = gettimeoffset * 60 * 1000;
    var len = date.getTime();
    var date2 = new Date(len - timeoffset);
    var sec = date2.getSeconds().toString();
    var min = date2.getMinutes().toString();
    if (sec.length === 1) {
      sec = "0" + sec;
    }
    if (min.length === 1) {
      min = "0" + min;
    }
    return date2.getFullYear().toString() + "/" + (date2.getMonth() + 1).toString() + "/" + date2.getDate().toString() + " " + date2.getHours().toString() + ":" + min + ":" + sec
  } catch (e) {
    return ""
  }
};

var timezoon = (datalist_slice) => {
  var time = datalist_slice[0][1][0][5];
  return formatDate(time)
};

//今日时间
var todaypost = () => {
  var date = new Date();
  var year = date.getFullYear();
  var month = (date.getMonth() + 1).toString();
  var day = (date.getDate()).toString();
  if (month.length === 1) {
    month = "0" + month;
  }
  if (day.length === 1) {
    day = "0" + day;
  }
  return year + "-" + month + "-" + day
};

//月份切片
var slice_month = (data) => {
  var monthlist = [];
  var datalist = [];
  var data_slice = data;
  for (var item in data_slice) {
    data_slice[item].push(item);
    if (data_slice[item][1].lenth !== 10) {
      var list = data_slice[item][1].split('-');
      if (list[1].length < 2) {
        list[1] = "0" + list[1]
      }
      if (list[2].length < 2) {
        list[2] = "0" + list[2]
      }
      data_slice[item][1] = list.join('-')
    }
    var month = data_slice[item][1].slice(0, 7);
    if (monthlist.indexOf(month) !== -1) {
      datalist[monthlist.length - 1][1].push(data_slice[item])
    } else {
      monthlist.push(month);
      datalist.push([month, [data_slice[item]]])
    }
  }
  for (var mounthgroup of datalist) {
    mounthgroup.push(mounthgroup[1][0][6]);
  }
  return datalist
};
```

引入的css修改了字体样式和位置：
```CSS
.moments-item-img img {
    border-radius: 50px;
}

.moments-item-info span {
    padding-left: .3rem;
    padding-right: .3rem;
    font-weight: 600;
}

a.moments-item-title {
    color: #4978f5 !important;
    font-weight: 900;
}

.moments_post_time {
    float: none !important;
    color: #ff612c;
}

[data-theme="dark"] a.moments-item-title {
    color: #cfa8ff !important;
    font-weight: 900;
}
```

--------

## 基于Butterfly的外挂标签引入

> 参考教程：店长的[Akilarの糖果屋-基于Butterfly的外挂标签引入](https://akilar.top/posts/615e2dec/)

因为这里涉及的源码修改都是直接拷贝的，所以不写新增和修改源码了。

--------

# 非主题源码修改区

## 双栏卡片主页文章

> 参考教程：冰老师的[教程：基于Butterfly主题的双栏卡片主页文章css样式](https://zfe.space/post/52914.html)

(我这里直接在主题配置文件引入冰老师的css，所以不涉及其他修改)

--------

## 字体样式修改

> 参考教程：店长的[Custom Beautify](https://akilar.top/posts/ebf20e02/)

```CSS
@font-face{
    font-family:'aqqxs' ;  /* 字体名自定义即可 */
    src:url('https://cdn1.tianli0.top/gh/2x-ercha/cdn-for-try/fonts/FXAiQingQiXiangSuo.ttf'); /* 字体文件路径 */
    font-display : swap;
}

h1,h2,h3,h4,h5,h6,
a#site-name,span#subtitle,a.site-page,
a.title,
#aside-content,
a.article-sort-item-title,
a.article-title,
a.categoryBar-list-link,
a.blog-slider__title,
.article-sort-title,
.tag-cloud-title,
.category-title,
a.category-list-link {
    font-family: 'aqqxs', sans-serif;
}
```

--------

## 版权字体微调

```CSS
.post-copyright {
    font-family: 'aqqxs', sans-serif;
    font-size: large
}
```

--------

## 首页磁铁字体微调

其实就是用阴影给分类的标题上了描边

```CSS
a.categoryBar-list-link {
    text-shadow: #0000001a 1px 0 0, #000000 0 1px 0, #000000 -1px 0 0, #00000000 0 -1px 0;
}
```

--------

## 鼠标样式及各种透明

> 参考文章：小康的[Hexo 博客之 butterfly 主题优雅魔改系列](https://www.antmoe.com/posts/a811d614/index.html)和店长的[Custom Beautify](https://akilar.top/posts/ebf20e02/)

```CSS
/* 鼠标样式 */
body {
    cursor: url(https://cdn1.tianli0.top/gh/sviptzk/HexoStaticFile@latest/Hexo/img/default.cur),
        default;
}
a,
img {
    cursor: url(https://cdn1.tianli0.top/gh/sviptzk/HexoStaticFile@latest/Hexo/img/pointer.cur),
        default;
}

/* 页脚透明 */
#footer{
    background: transparent!important;
}

/* 头图透明 */
#page-header{
  background: transparent!important;
}

/*top-img黑色透明玻璃效果移除，不建议加，除非你执着于完全一图流或者背景图对比色明显 */
#page-header.post-bg:before {
  background-color: transparent!important;
}

/*夜间模式伪类遮罩层透明*/
[data-theme="dark"] #footer::before{
  background: transparent!important;
}
[data-theme="dark"] #page-header::before{
  background: transparent!important;
}
```

--------

## Twikoo评论框高度

根据店长的建议修改成了这样：

> - 首先只需要设置最小高度即可，不需要再加一条高度（虽然文本框是超出转换为滚动条的，但是还是要符合开发逻辑才行啊）。
> - 然后加一条在聚焦状态下的样式，隐藏图片。这样手机端输入的时候不会被背景图片影响文字输入。

```CSS
.tk-input[data-v-619b4c52]
  .el-textarea__inner{
    min-height: 210px !important;
  }
  .el-textarea__inner:focus{
      background-image: none !important;
  }
```

--------

## 卡片背景透明度颜色重写

**PS: 这个其实准备重新弄了**

```CSS
:root {
  /* --card-bg: #fff; */
  --card-bg: #ffefefd9;
}

[data-theme="dark"] {
  /* --card-bg: #121212; */
  --card-bg: #12121288;
  --btn-hover-color: #787878;
  --btn-bg: #1f1f1f;
  --btn-hover-color: #ff3f3f;
  --btn-bg: #a153ff;
  /* --font-color: rgba(255,255,255,0.7); */
  /* --hr-border: rgba(255,255,255,0.4); */
  --font-color: rgb(255, 255, 255);
  --hr-border: rgb(161, 83, 255);
}
```

--------

## 标签外挂css微调

店长那直接白嫖过来的标签外挂不怎么适合我的颜色魔改，所以也相应地做了微调

```CSS
#article-container .tabs > .tab-contents .tab-item-content.active{
    background-color: #ffffffaa;
}

[data-theme="dark"] #article-container .tabs > .tab-contents .tab-item-content.active{
    background-color: #0000005e;
}
```

-------

# 另外这里给店长打个广告

**butterfly魔改售后服务中心**<del>（其实就是店长自己的群）</del>

<img src=https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/akicandyroom.jpg alt='🧊Akilarの糖果屋' style='max-height:500px'>