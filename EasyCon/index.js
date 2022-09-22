"nodejs";
const usbserial = require('../usbserial');
let serial = null;
const SwitchStick = {
    STICK_MIN: 0,
    STICK_CENMIN: 64,
    STICK_CENTER: 128,
    STICK_CENMAX: 192,
    STICK_MAX: 255,
}
// SwitchButton
const SwitchButton = {
    NONE: [0, 0],
    Y: [0x00, 0x01],
    B: [0x00, 0x02],
    A: [0x00, 0x04],
    X: [0x00, 0x08],
    L: [0x00, 0x10],
    R: [0x00, 0x20],
    ZL: [0x00, 0x40],
    ZR: [0x00, 0x80],
    MINUS: [0x01, 0x00],
    PLUS: [0x02, 0x00],
    LCLICK: [0x04, 0x00],
    RCLICK: [0x08, 0x00],
    HOME: [0x10, 0x00],
    CAPTURE: [0x20, 0x00],
}
const SwitchHAT = {
    TOP: 0x00,
    TOP_RIGHT: 0x01,
    RIGHT: 0x02,
    BOTTOM_RIGHT: 0x03,
    BOTTOM: 0x04,
    BOTTOM_LEFT: 0x05,
    LEFT: 0x06,
    TOP_LEFT: 0x07,
    CENTER: 0x08,
}

const DirectionKey = {
    None: 0x0,
    Up: 0x1,
    Down: 0x2,
    Left: 0x4,
    Right: 0x8,
}

const Command = {
    Ready: 0xA5,
    Debug: 0x80,
    Hello: 0x81,
    Flash: 0x82,
    ScriptStart: 0x83,
    ScriptStop: 0x84,
    Version: 0x85,
    LED: 0x86,
    UnPair: 0x87,
    ChangeControllerMode: 0x88,
    ChangeControllerColor: 0x89,
    SaveAmiibo: 0x90,
    ChangeAmiiboIndex: 0x91,
}

const Reply = {
    Error: 0x0,
    Busy: 0xFE,
    Ack: 0xFF,
    Hello: 0x80,
    FlashStart: 0x81,
    FlashEnd: 0x82,
    ScriptAck: 0x83,
}
const ReplyToStr = {
    0x0: "Error",
    0xFE: "Busy",
    0xFF: "Ack",
    0x80: "Hello",
    0x81: "FlashStart",
    0x82: "FlashEnd",
    0x83: "ScriptAck",
}
function CodeFromKey(button = SwitchButton.NONE, hat = SwitchHAT.CENTER, lx = SwitchStick.STICK_CENTER, ly = SwitchStick.STICK_CENTER, rx = SwitchStick.STICK_CENTER, ry = SwitchStick.STICK_CENTER) {
    serialized = [button[0], button[1], hat, lx, ly, rx, ry];
    return CodeFromSerialized(serialized);
}
function ReserveByte(c) {
    let newc = 0x00;
    for (i = 0; i < 7; i++) {
        newc |= (c & 1);
        newc <<= 1;
        c >>= 1;
    }
    return newc;
}
function CodeFromSerialized(serialized) {
    let n = 0;
    let bits = 0;
    let packet = [];
    for (let i = 0; i < serialized.length; i++) {
        let b = serialized[i];
        n = (n << 8) | b;
        bits += 8;
        while (bits >= 7) {
            bits -= 7;
            packet.push((n >> bits) & 0xFF);
            n &= (1 << bits) - 1;
        }
    }
    packet[packet.length - 1] |= 0x80;
    return packet;
}


const BytesReceiveQueue = [];
function PushBytesReceive(bs, foo, desc) {
    BytesReceiveQueue.push(
        {
            byte_size: bs,
            commit: foo,
            desc: desc,
        }
    );
}
async function HelloCheck() {
    let hello_checked = false;
    PushBytesReceive(1, (bytes) => {
        if (Reply.Hello == bytes[0]) {
            hello_checked = true;
            return true;
        }
        return false;
    }, "HelloReceiver");
    usbserial.SerialWriteListAsync(serial, [Command.Ready, Command.Ready, Command.Hello]);
    for (let i = 0; i < 10; i++) {
        if (hello_checked) {
            return hello_checked;
        }
        await new Promise(r => setTimeout(r, 10));
    }
    return hello_checked;
}
async function Version() {
    let version = -10000;
    PushBytesReceive(1, (bytes) => {
        version = bytes[0];
        return true;
    }, "VersionReceiver");
    usbserial.SerialWriteListAsync(serial, [Command.Ready, Command.Ready, Command.Version]);
    for (let i = 0; i < 10; i++) {
        if (version != -10000) {
            return version;
        }
        await new Promise(r => setTimeout(r, 10));
    }
    return version;
}
async function Report(
    button = SwitchButton.NONE,
    hat = SwitchHAT.CENTER,
    lx = SwitchStick.STICK_CENTER,
    ly = SwitchStick.STICK_CENTER,
    rx = SwitchStick.STICK_CENTER,
    ry = SwitchStick.STICK_CENTER) {
    let ack = false;
    let error_code = -999;
    PushBytesReceive(1, (bytes) => {
        if (Reply.Ack == bytes[0]) {
            ack = true;
            return true;
        }
        error_code = bytes[0];
        return false;
    }, "ReportAckReceiver");
    usbserial.SerialWriteListAsync(serial, CodeFromKey(button, hat, lx, ly, rx, ry));
    for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2));
        if (ack) {
            return ack;
        }
    }
    //console.log("[Report] error_code: " + error_code);
    return ack;
}

module.exports = {
    SwitchStick: SwitchStick,
    SwitchButton: SwitchButton,
    SwitchHAT: SwitchHAT,
    DirectionKey: DirectionKey,
    Command: Command,
    Reply: Reply,
    ReplyToStr: ReplyToStr,
    CodeFromKey: CodeFromKey,
    CodeFromSerialized: CodeFromSerialized,
    ReserveByte: ReserveByte,
    // 常用函数
    // note. 传输出错时,返回数据可能会错位,错位会影响前后两个命令
    Report: Report,
    Version: Version,
    HelloCheck: HelloCheck,
    // 串口操作
    PushBytesReceive: PushBytesReceive,
    // 托管串口
    SetEasyConSerial: function (ser) {
        serial = ser;
        // reset BytesReceiveQueue
        BytesReceiveQueue.length = 0;
        // serial read callback
        let receiver = null;
        let bytes = [];
        usbserial.SerialReadListAsync(serial, (intList) => {
            for (let i = 0; i < intList.length; i++) {
                let hex = Buffer([intList[i]]);
                if (!receiver && BytesReceiveQueue.length > 0) {
                    receiver = BytesReceiveQueue.shift();
                    console.log("[SerialReadListAsync] " + receiver.desc + " " + receiver.byte_size);
                } else if (!receiver) {
                    console.log("[SerialReadListAsync] received: 0x" + hex.toString('hex') + " " + ReplyToStr[parseInt(hex.toString('hex'), 16)]);
                    continue;
                }
                // 有已注册的回调, 则按预期字节数返回
                receiver.byte_size--;
                bytes.push(parseInt(hex.toString('hex'), 16));
                if (receiver.byte_size == 0) {
                    let ret = receiver.commit(bytes);
                    // 回调返回错误, 可能是乱序了;
                    // 乱序时read buffer和 receive queue已经不匹配, 应当全部清空, 避免一直错下去
                    if (!ret) {
                        console.log("[SerialReadListAsync] ClearAll: " + BytesReceiveQueue + " " + intList);
                        BytesReceiveQueue.length = 0;
                        bytes.length = 0;
                        receiver = null;
                        break;
                    }
                    bytes.length = 0;
                    receiver = null;
                }
            }
        });
    },
}