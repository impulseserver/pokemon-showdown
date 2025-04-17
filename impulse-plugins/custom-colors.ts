/**
 * Custom Colors Commands
 * Original Credits: panpawn, jd, HoeenHero
 * Updated By: Prince Sky
 */

import * as crypto from 'crypto';
import { FS } from '../lib/fs';

// Types and Interfaces
interface RGB {
    R: number;
    G: number;
    B: number;
}

interface CustomColors {
    [userid: string]: string;
}

// Constants
const STAFF_ROOM_ID = 'staff';
const DATABASE_PATH = 'impulse-db/customcolors.json';
const CSS_PATH = 'config/custom.css';
const CSS_MARKERS = {
    START: '/* COLORS START */',
    END: '/* COLORS END */'
};

// Cache and State
const colorCache: Record<string, string> = {};
let customColors: CustomColors = {};

// Initialize custom colors from database
try {
    const customColorsData = FS(DATABASE_PATH).readIfExistsSync();
    if (customColorsData) {
        customColors = JSON.parse(customColorsData);
    }
} catch (e: any) {
    console.error('Error loading customcolors.json:', e);
}

/**
 * Converts HSL color values to RGB
 * @param H - Hue (0-360)
 * @param S - Saturation (0-100)
 * @param L - Lightness (0-100)
 * @returns RGB color values
 */
function HSLToRGB(H: number, S: number, L: number): RGB {
    const C: number = (100 - Math.abs(2 * L - 100)) * S / 100 / 100;
    const X: number = C * (1 - Math.abs((H / 60) % 2 - 1));
    const m: number = L / 100 - C / 2;
    
    let [R1, G1, B1] = [0, 0, 0];
    
    switch (Math.floor(H / 60)) {
        case 0: [R1, G1] = [C, X]; break;
        case 1: [R1, G1] = [X, C]; break;
        case 2: [G1, B1] = [C, X]; break;
        case 3: [G1, B1] = [X, C]; break;
        case 4: [R1, B1] = [X, C]; break;
        case 5: [R1, B1] = [C, X]; break;
    }
    
    return { R: R1 + m, G: G1 + m, B: B1 + m };
}

/**
 * Generates a consistent color hash for a username
 * @param name - Username to generate color for
 * @returns Hex color code
 */
function nameColor(name: string): string {
    const id = toID(name);
    
    // Return cached or custom color if available
    if (customColors[id]) return customColors[id];
    if (colorCache[id]) return colorCache[id];
    
    // Generate color hash
    const hash: string = crypto.createHash('md5').update(id).digest('hex');
    const H: number = parseInt(hash.substr(4, 4), 16) % 360;
    const S: number = (parseInt(hash.substr(0, 4), 16) % 50) + 40;
    let L: number = Math.floor(parseInt(hash.substr(8, 4), 16) % 20 + 30);
    
    // Initial color conversion
    let { R, G, B } = HSLToRGB(H, S, L);
    
    // Luminance adjustments
    const lum: number = R * R * R * 0.2126 + G * G * G * 0.7152 + B * B * B * 0.0722;
    let HLmod: number = (lum - 0.2) * -150;
    
    if (HLmod > 18) HLmod = (HLmod - 18) * 2.5;
    else if (HLmod < 0) HLmod /= 3;
    
    const Hdist: number = Math.min(Math.abs(180 - H), Math.abs(240 - H));
    if (Hdist < 15) {
        HLmod += (15 - Hdist) / 3;
    }
    
    L += HLmod;
    
    // Final color conversion
    const { R: r, G: g, B: b } = HSLToRGB(H, S, L);
    
    // Convert to hex
    const toHex = (x: number): string => {
        const hex: string = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    
    const finalColor: string = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    colorCache[id] = finalColor;
    return finalColor;
}

Impulse.hashColor = nameColor;

/**
 * Updates custom colors in database and CSS
 */
function updateColor(): void {
    // Update database
    FS(DATABASE_PATH).writeUpdate(() => JSON.stringify(customColors));
    
    // Generate new CSS
    let newCss: string = CSS_MARKERS.START + '\n';
    for (const name in customColors) {
        newCss += generateCSS(name, customColors[name]);
    }
    newCss += CSS_MARKERS.END + '\n';
    
    // Update CSS file
    const file: string[] = FS(CSS_PATH).readIfExistsSync().split('\n');
    const start: number = file.indexOf(CSS_MARKERS.START);
    const end: number = file.indexOf(CSS_MARKERS.END);
    
    if (start !== -1 && end !== -1) {
        file.splice(start, (end - start) + 1);
    }
    
    FS(CSS_PATH).writeUpdate(() => file.join('\n') + newCss);
    Impulse.reloadCSS();
}

/**
 * Generates CSS for a custom color
 */
function generateCSS(name: string, color: string): string {
    const id: string = toID(name);
    return `[class$="chatmessage-${id}"] strong, ` +
        `[class$="chatmessage-${id} mine"] strong, ` +
        `[class$="chatmessage-${id} highlighted"] strong, ` +
        `[id$="-userlist-user-${id}"] strong em, ` +
        `[id$="-userlist-user-${id}"] strong, ` +
        `[id$="-userlist-user-${id}"] span` +
        `{\n\tcolor: ${color} !important;\n}\n`;
}

// Chat Commands
export const commands: Chat.Commands = {
    customcolor: {
        set(target: string, room: ChatRoom, user: User): void {
            this.checkCan('globalban');
            const targets: string[] = target.split(',').map(t => t.trim());
            if (!targets[1]) return this.parse('/help customcolor');
            
            const targetId = toID(targets[0]);
            if (targetId.length > 19) return this.errorReply("Usernames are not this long...");
            
            this.sendReply(`|raw|You have given <b><font color="${targets[1]}">${Chat.escapeHTML(targets[0])}</font></b> a custom color.`);
            this.modlog(`CUSTOMCOLOR`, targets[0], `gave color ${targets[1]}`);
            customColors[targetId] = targets[1];
            updateColor();
            
            const staffRoom = Rooms.get(STAFF_ROOM_ID);
            if (staffRoom) {
                staffRoom.add(
                    `|html|<div class="infobox">${Impulse.nameColor(user.name, true, true)} set custom color for ` +
                    `${Impulse.nameColor(targets[0], true, false)} to ${targets[1]}.</div>`
                ).update();
            }
        },
        
        delete(target: string, room: ChatRoom, user: User): void {
            this.checkCan('globalban');
            if (!target) return this.parse('/help customcolor');
            
            const targetId: string = toID(target);
            if (!customColors[targetId]) return this.errorReply(`/customcolor - ${target} does not have a custom color.`);
            
            delete customColors[targetId];
            updateColor();
            this.sendReply(`You removed ${target}'s custom color.`);
            this.modlog(`CUSTOMCOLOR`, target, `removed custom color`);
            
            const targetUser: User | null = Users.get(target);
            if (targetUser?.connected) {
                targetUser.popup(`${user.name} removed your custom color.`);
            }
            
            const staffRoom = Rooms.get(STAFF_ROOM_ID);
            if (staffRoom) {
                staffRoom.add(
                    `|html|<div class="infobox">${Impulse.nameColor(user.name, true, true)} removed custom color for ` +
                    `${Impulse.nameColor(target, true, false)}.</div>`
                ).update();
            }
        },
        
        preview(target: string, room: ChatRoom, user: User): void {
            if (!this.runBroadcast()) return;
            const targets: string[] = target.split(',').map(t => t.trim());
            if (!targets[1]) return this.parse('/help customcolor');
            return this.sendReplyBox(`<b><font size="3" color="${targets[1]}">${Chat.escapeHTML(targets[0])}</font></b>`);
        },
        
        reload(target: string, room: ChatRoom, user: User): void {
            this.checkCan('lockdown');
            updateColor();
            this.privateModAction(`(${user.name} has reloaded custom colours.)`);
        },
        
        '(target: string, room: ChatRoom, user: User): void'() {
            return this.parse("/help customcolor");
        },
    },
    
    customcolorhelp(target, room, user) {
        if (!this.runBroadcast()) return;
        this.sendReplyBox(
            `<details><summary><b><center>Custom Color Commands</center></b></summary>` +
            `<ul>` +
            `<li><code>/customcolor set [user],[hex]</code> - Gives [user] a custom color of [hex] (Requires: @ and higher)</li>` +
            `<li><code>/customcolor delete [user]</code> - Deletes a user's custom color (Requires: @ and higher)</li>` +
            `<li><code>/customcolor reload</code> - Reloads colors. (Requires: ~)</li>` +
            `<li><code>/customcolor preview [user],[hex]</code> - Previews what that username looks like with [hex] as the color.</li>` +
            `</ul></details>`
        );
    },
    
    '!hex': true,
    hex(target: string, room: ChatRoom, user: User): void {
        if (!this.runBroadcast()) return;
        const targetUser: string = target || user.name;
        const color: string = nameColor(targetUser);
        this.sendReplyBox(
            `The hex code of ${Impulse.nameColor(targetUser, true, true)} is: ` +
            `<font color="${color}"><b>${color}</b></font>`
        );
    },
};
