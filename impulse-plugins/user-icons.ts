/******************************************
* Pokemon Showdown Custom Icon Commands   *
* Original Code By: Lord Haji, Panpawn    *
* Updated By: Prince Sky    *
*******************************************/

import { FS } from '../lib/fs';

// Constants
const backgroundColor = `rgba(17, 72, 79, 0.6)`;
const STAFF_ROOM_ID = 'staff';

// Interfaces
interface Icons {
	[userid: string]: string;
}

// State
let icons: Icons = {};

// Initialize icons from file
try {
	const iconsData = FS('impulse-db/usericons.json').readIfExistsSync();
	if (iconsData) {
		icons = JSON.parse(iconsData);
	}
} catch (err) {
	console.error(`Failed to parse usericons.json:`, err);
}

// Helper Functions
async function updateIcons(): Promise<void> {
	try {
		// Save icons to JSON file
		await FS('impulse-db/usericons.json').writeUpdate(() => JSON.stringify(icons));
		
		// Generate CSS
		let newCss = '/* ICONS START */\n';
		for (const name in icons) {
			newCss += `[id$="-userlist-user-${toID(name)}"] { background: ${backgroundColor} url("${icons[name]}") right no-repeat !important;}\n`;
		}
		newCss += '/* ICONS END */\n';
		
		// Update CSS file
		const file = FS('config/custom.css').readIfExistsSync().split('\n');
		const start = file.indexOf('/* ICONS START */');
		const end = file.indexOf('/* ICONS END */');
		if (start !== -1 && end !== -1) {
			file.splice(start, (end - start) + 1);
		}
		await FS('config/custom.css').writeUpdate(() => file.join('\n') + newCss);
		
		// Reload CSS
		Impulse.reloadCSS();
	} catch (err) {
		console.error('Error updating icons:', err);
	}
}

// Chat Commands
export const commands: Chat.ChatCommands = {
	usericon: 'icon',
	icon: {
		// Set an icon for a user
		async set(this: CommandContext, target: string, room: Room, user: User) {
			this.checkCan('globalban');
			const [name, imageUrl] = target.split(',').map(s => s.trim());
			if (!name || !imageUrl) return this.parse('/help icon');
			
			const userId = toID(name);
			if (userId.length > 19) return this.errorReply('Usernames are not this long...');
			if (icons[userId]) return this.errorReply('This user already has an icon. Remove it first with /icon delete [user].');
			
			// Set the icon
			icons[userId] = imageUrl;
			await updateIcons();
			this.sendReply(`|raw|You have given ${Impulse.nameColor(name, true, false)} an icon.`);
			
			// Notify the target user
			const targetUser = Users.get(userId);
			if (targetUser?.connected) {
				targetUser.popup(`|html|${Impulse.nameColor(user.name, true, true)} has set your userlist icon to: <img src="${imageUrl}" width="32" height="32"><br /><center>Refresh, If you don't see it.</center>`);
			}
			
			// Notify staff room
			const staffRoom = Rooms.get(STAFF_ROOM_ID);
			if (staffRoom) {
				staffRoom.add(`|html|<div class="infobox"> ${Impulse.nameColor(user.name, true, true)} set icon for ${Impulse.nameColor(name, true, false)}: <img src="${imageUrl}" width="32" height="32"></div>`).update();
			}
		},
		
		// Delete a user's icon
		async delete(this: CommandContext, target: string, room: Room, user: User) {
			this.checkCan('globalban');
			const userId = toID(target);
			if (!icons[userId]) return this.errorReply(`${target} does not have an icon.`);
			
			// Remove the icon
			delete icons[userId];
			await updateIcons();
			this.sendReply(`You removed ${target}'s icon.`);
			
			// Notify the target user
			const targetUser = Users.get(userId);
			if (targetUser?.connected) {
				targetUser.popup(`|html|${Impulse.nameColor(user.name, true, true)} has removed your userlist icon.`);
			}
			
			// Notify staff room
			const staffRoom = Rooms.get(STAFF_ROOM_ID);
			if (staffRoom) {
				staffRoom.add(`|html|<div class="infobox">${Impulse.nameColor(user.name, true, true)} removed icon for ${Impulse.nameColor(target, true, false)}.</div>`).update();
			}
		},

		// Default handler for /icon with no arguments
		''(target, room, user) {
			this.parse('/iconhelp');
		},
	},
	
	// Help command for icons
	iconhelp(target: string, room: ChatRoom | null, user: User) {
		if (!this.runBroadcast()) return;
		this.sendReplyBox(
			`<details><summary><center><b>Custom Icon Commands:</b></center></summary>` +
			`• <code>/icon set [username], [image url]</code> - Gives [user] an icon (Requires: @ and higher)<br>` +
			`• <code>/icon delete [username]</code> - Removes a user's icon (Requires: @ and higher)</details>`
		);
	},
};
