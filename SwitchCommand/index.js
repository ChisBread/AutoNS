"nodejs";

const SwitchStick = {
    STICK_MIN: 0,
    STICK_CENMIN: 64,
    STICK_CENTER: 128,
    STICK_CENMAX: 192,
    STICK_MAX: 255,
}
// SwitchButton
const SwitchButton = {
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
function CodeFromKey(button, hat = 0x08, lx = 0x0, ly = 0x0, rx = 0x0, ry = 0x0) {
    serialized = [button[1], button[0], hat, lx, ly, rx, ry];
    return CodeFromSerialized(serialized);
}
function reserveByte(c) {
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
module.exports = {
    SwitchStick: SwitchStick,
    SwitchButton: SwitchButton,
    SwitchHAT: SwitchHAT,
    DirectionKey: DirectionKey,
    Command: Command,
    Reply: Reply,
    CodeFromKey: CodeFromKey,
    CodeFromSerialized: CodeFromSerialized,
}