/**
 * Impulse Server Utility Functions
 * Original Credits: Unknown
 * Updates & TypeScript Conversion: Prince Sky
 */

import https from 'https';

/**
 * Server Name
 */
Impulse.serverName = 'Impulse';

/**
 * Applies color formatting to a username with optional bold and group symbol
 * @param name - The username to format
 * @param bold - Whether to make the name bold
 * @param userGroup - Whether to show the user's group symbol
 * @param room - The room context (optional)
 * @returns Formatted HTML string containing the colored username
 * @example
 * Impulse.nameColor("username", true, true, room);
 */
function nameColor(
    name: string,
    bold: boolean = false,
    userGroup: boolean = false,
    room: Room | null = null
): string {
    const userId = toID(name);
    const groupSymbol = Users.globalAuth.get(userId);
    const userGroupSymbol = groupSymbol ? `<font color=#948A88>${groupSymbol}</font>` : "";
    const userName = Users.getExact(name)
        ? Chat.escapeHTML(Users.getExact(name).name)
        : Chat.escapeHTML(name);

    return (userGroup ? userGroupSymbol : "") +
        (bold ? "<b>" : "") +
        `<font color=${Impulse.hashColor(name)}>${userName}</font>` +
        (bold ? "</b>" : "");
}

Impulse.nameColor = nameColor;

/**
 * Reloads the server's custom CSS
 * @example
 * Impulse.reloadCSS();
 */
function reloadCSS(): void {
    const cssPath = 'impulse';
    const serverId = Config.serverid || cssPath;
    const url = `https://play.pokemonshowdown.com/customcss.php?server=${serverId}`;

    const req = https.get(url, (res) => {
        console.log(`CSS reload response: ${res.statusCode}`);
    });

    req.on('error', (err) => {
        console.error(`Error reloading CSS: ${err.message}`);
    });

    req.end();
}

Impulse.reloadCSS = reloadCSS;

/**
 * Clears specified rooms and handles user disconnection/reconnection
 * @param rooms - Array of rooms to clear
 * @param user - User initiating the clear
 * @returns Array of cleared room IDs
 * @warning Internal use only - Used by /clearall & /globalclearall commands
 */
function clearRooms(rooms: Room[], user: User): string[] {
    const clearedRooms: string[] = [];
    const RECONNECT_DELAY = 1000; // 1 second delay for reconnection

    for (const room of rooms) {
        if (!room) continue;

        // Clear room logs
        if (room.log.log) {
            room.log.log.length = 0;
        }

        // Handle user disconnection and reconnection
        const userIds = Object.keys(room.users) as ID[];
        
        // Disconnect users
        for (const userId of userIds) {
            disconnectUserFromRoom(userId, room);
        }

        clearedRooms.push(room.id);

        // Reconnect users after delay
        setTimeout(() => {
            for (const userId of userIds) {
                reconnectUserToRoom(userId, room);
            }
        }, RECONNECT_DELAY);
    }

    return clearedRooms;
}

/**
 * Helper function to disconnect a user from a room
 */
function disconnectUserFromRoom(userId: ID, room: Room): void {
    const userObj = Users.get(userId);
    if (userObj?.connections?.length) {
        for (const connection of userObj.connections) {
            userObj.leaveRoom(room, connection);
        }
    }
}

/**
 * Helper function to reconnect a user to a room
 */
function reconnectUserToRoom(userId: ID, room: Room): void {
    const userObj = Users.get(userId);
    if (userObj?.connections?.length) {
        for (const connection of userObj.connections) {
            userObj.joinRoom(room, connection);
        }
    }
}

Impulse.clearRooms = clearRooms;

/**
 * Generates a random string of specified length
 * @param length - Length of the string to generate
 * @returns Random string containing alphanumeric characters
 * @example
 * Impulse.generateRandomString(10);
 */
function generateRandomString(length: number): string {
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
        result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    
    return result;
}

Impulse.generateRandomString = generateRandomString;

/**
 * Generates a themed HTML table with consistent styling
 * @param title - The title of the table
 * @param headerRow - Array of header column names
 * @param dataRows - 2D array of table data
 * @param styleBy - Optional credit for table styling
 * @returns HTML string containing the formatted table
 * 
 * @example
 * const table = Impulse.generateThemedTable(
 *   "Rich List",
 *   ["Rank", "User", "Balance"],
 *   [["1", "User1", "$1000"], ["2", "User2", "$500"]],
 *   "impulseserver"
 * );
 */
function generateThemedTable(
    title: string,
    headerRow: string[],
    dataRows: string[][],
    styleBy?: string
): string {
    // Container with overflow handling
    let output = `<div class="themed-table-container" style="max-width: 100%; overflow-x: auto;">` +
        
        // Table title
        `<h3 class="themed-table-title">${title}</h3>`;

    // Optional style credit
    if (styleBy) {
        output += `<p class="themed-table-by">Style By ${styleBy}</p>`;
    }

    // Table opening with styling
    output += `<table class="themed-table" style="width: 100%; border-collapse: collapse;">`;

    // Header row
    output += `<tr class="themed-table-header">` +
        headerRow.map(header => `<th>${header}</th>`).join('') +
        `</tr>`;

    // Data rows
    output += dataRows.map(row =>
        `<tr class="themed-table-row">` +
        row.map(cell => `<td>${cell}</td>`).join('') +
        `</tr>`
    ).join('');

    // Close table and container
    output += `</table>` +
        `</div>`;

    return output;
}

// Export to Impulse namespace
Impulse.generateThemedTable = generateThemedTable;

/**
 * CSS Classes Used:
 * .themed-table-container - Container for the table with overflow handling
 * .themed-table-title    - Table title styling
 * .themed-table-by      - Style credit text
 * .themed-table         - Main table styling
 * .themed-table-header  - Header row styling
 * .themed-table-row     - Data row styling
 */
