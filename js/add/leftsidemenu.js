document.addEventListener('DOMContentLoaded', function () {
    const leftSideMenu = {
        qrcodeHover: () => {
            // 按钮获取
            const left_menu = document.getElementById('left_menu')
            if(left_menu){
                const leftside_qq = left_menu.getElementsByClassName('leftside-qq')[0]
                // 显示区域获取
                const left_display = document.getElementById('left_display')
                const candy_qrcode = left_display.getElementsByClassName('candy_qrcode')[0]

                leftside_qq.addEventListener('mouseover', function () {
                    candy_qrcode.style.opacity = "1"
                })
                leftside_qq.addEventListener('mouseout', function () {
                    candy_qrcode.style.opacity = "0"
                })
            }
        }
    }

    leftSideMenu.qrcodeHover();
})