"nodejs";
const $java = $autojs.java;
require('rhino').install();
const { showToast } = require('toast');
const { select } = require('accessibility');
const usbserial = require('./usbserial');
const EasyCon = require('./EasyCon');
let serial = null;
async function AmiiboTest() {
    let ret = await EasyCon.SaveAmiiboFromBin(0, "./amiibo/Breath of the Wild/[ZBW] 04 - Link (Rider).bin")
    console.log(ret);
    ret = await EasyCon.ChangeAmiiboIndex(0);
    console.log(ret);
}
async function Init() {
    // connect to serial and auto confirm
    let confirm = select({ text: "确定", className: "android.widget.Button" }).atLeast(1).maxRetries(10).timeout(10000).first().then((res) => {
        try {
            res.click();
        } catch (e) {
            return e;
        }
    }).catch((e) => { console.log(e); });
    serial = await usbserial.ConnectTo(baudRate = 115200);
    await confirm;
    if (!serial) {
        console.log("error connect");
        return;
    }
    EasyCon.SetEasyConSerial(serial);

    let ret = await EasyCon.Hello();
    console.log("Hello: " + ret);
    if (!ret) {
        return false;
    }
    ret = await EasyCon.Version();
    console.log("Version: " + ret)
    return true;
}
async function Main() {
    if (await Init()) {
        showToast('Welcome to AutoNS!');
    }
    await AmiiboTest();
    await new Promise(r => setTimeout(r, 1000));
    serial.close();
    showToast('Byebye!');
}
Main().catch(console.error);
