document.addEventListener('DOMContentLoaded', function () {
    const leftSideMenu = {
        qrcodeHover: () => {
            // 按钮获取
            const $left_menu = document.getElementById('left_menu')
            const $leftside_qq = $left_menu.getElementsByClassName('leftside-qq')[0]
            //const $leftside_qq = $left_menu.getElementById('leftside-qq')
            // 显示区域获取
            const $left_display = document.getElementById('left_display')
            const $candy_qrcode = $left_display.getElementsByClassName('candy_qrcode')[0]
            
            $leftside_qq.addEventListener('onmouseover', function () {
                console.log("111")
                $candy_qrcode.style.opacity = "1"
            })

            $leftside_qq.addEventListener('onmouseout', function () {
                console.log("222")
                $candy_qrcode.style.opacity = "0"
            })
           
        }
    }

    leftSideMenu.qrcodeHover();
})