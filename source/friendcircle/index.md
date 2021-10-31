---
title: 兔子要吃窝边草
date: 2021-02-08 03:24:04
aplayer: false
sitemap: false
---
## 邻居们的好文章

**就是朋友圈啦！**

<!-- fontawesome图标的依赖，主题自带的不用加这行 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free/css/all.min.css">

<!-- 友链朋友圈样式 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Rock-Candy-Tea/hexo-friendcircle-demo@main/css/akilar-SAO.css">

<!-- 挂载友链朋友圈的容器 -->
<div id="fcircleContainer"></div>

<!-- 全局引入友链朋友圈配置项 -->
<script>
  // 全局变量声明区域
  var fdata = {
    apiurl: 'https://hexo-friendcircle3-api.vercel.app/api',
    initnumber: 20, //【可选】页面初始化展示文章数量
    stepnumber: 10,//【可选】每次加载增加的篇数
    error_img: '/image/404.gif' //【可选】头像加载失败时默认显示的头像
  }
  //存入本地存储
  localStorage.setItem("fdatalist",JSON.stringify(fdata))
</script>

<!-- 全局引入抓取方法 -->
<script defer src="https://cdn.jsdelivr.net/gh/Rock-Candy-Tea/hexo-friendcircle-demo@main/js/fetch.js"></script>
<!-- 局部引入页面元素生成方法 -->
<script async src="https://cdn.jsdelivr.net/gh/Rock-Candy-Tea/hexo-friendcircle-demo@main/js/fcircle.js" charset="utf-8"></script>