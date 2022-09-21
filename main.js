"nodejs";
const $java = $autojs.java;
require('rhino').install();
const { showToast } = require('toast');
const { select } = require('accessibility');
const usbserial = require('./usbserial');
const SwitchCommand = require('./SwitchCommand');
async function Main() {
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
    // serial read callback
    usbserial.SerialReadListAsync(serial, (intList) => {
        let buffer = Buffer(intList);
        console.log("received: " + buffer.toString('hex'));
    });
    // button A
    // write byte
    usbserial.SerialWriteListAsync(serial, [SwitchCommand.Command.Ready, SwitchCommand.Command.Ready, SwitchCommand.Command.Hello]);
    usbserial.SerialWriteListAsync(serial, [SwitchCommand.Command.Ready, SwitchCommand.Command.Ready, SwitchCommand.Command.Version]);


    cmdcode = [SwitchCommand.Command.Ready].concat(SwitchCommand.CodeFromKey(SwitchCommand.SwitchButton.B));
    console.log("command: " + Buffer(cmdcode).toString('hex'));
    await new Promise(r => setTimeout(r, 50));
    usbserial.SerialWriteListAsync(serial, cmdcode);

    await new Promise(r => setTimeout(r, 50));

    await new Promise(r => setTimeout(r, 5000));
    serial.close();
}
console.log(process.versions);
showToast('Hello, Auto.js Pro with Node.js!');
Main().catch(console.error);
showToast('Byebye!');
