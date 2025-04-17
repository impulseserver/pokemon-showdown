import { FS } from '../lib/fs';

interface JikanMediaBase {
    mal_id: number;
    title: string;
    title_english: string | null;
    status: string | null;
    genres: { name: string; }[];
    synopsis: string | null;
    images: { jpg: { image_url: string; }; };
    rating: string | null;
}

interface JikanAnime extends JikanMediaBase {
    episodes: number | null;
    aired?: { from: string; };
}

interface JikanManga extends JikanMediaBase {
    chapters: number | null;
    volumes: number | null;
}

const ADULT_RATINGS = [
    'Rx - Hentai',
    'R+ - Mild Nudity',
    'R - 17+ (Violence & Profanity)'
];

const API_CONFIG = {
    BASE_URL: 'https://api.jikan.moe/v4',
    DEFAULT_LIMIT: 1,
    UPCOMING_LIMIT: 5
};

async function fetchJikanData<T>(type: 'anime' | 'manga', query?: string): Promise<T[]> {
    try {
        const endpoint = query 
            ? `${API_CONFIG.BASE_URL}/${type}?q=${encodeURIComponent(query)}&limit=${API_CONFIG.DEFAULT_LIMIT}`
            : `${API_CONFIG.BASE_URL}/seasons/upcoming`;

        const response = await fetch(endpoint);
        const data = await response.json();

        if (!data.data?.length) {
            console.log(`No ${type} found${query ? ` for '${query}'` : ''} on Jikan.`);
            return [];
        }

        return query ? data.data : data.data.slice(0, API_CONFIG.UPCOMING_LIMIT);
    } catch (error) {
        console.error(`Error fetching ${type} from Jikan API:`, error);
        return [];
    }
}

function createDisplayBox(info: JikanAnime | JikanManga, type: 'anime' | 'manga', truncateLength = 500): string {
    // Adult content warning check
    if (info.rating && ADULT_RATINGS.includes(info.rating)) {
        return `Warning: The ${type} '${Chat.escapeHTML(info.title)}' may contain mature content (rated ${Chat.escapeHTML(info.rating)}). Viewer discretion is advised.`;
    }

    let html = buildBaseDisplayHtml(info);
    html += buildMediaSpecificHtml(info, type);
    html += buildGenresHtml(info);
    html += buildSynopsisHtml(info, type, truncateLength);
    html += `<a href="https://myanimelist.net/${type}/${info.mal_id}" target="_blank" style="text-decoration: none;">View on MyAnimeList</a></div></div>`;

    return html;
}

function buildBaseDisplayHtml(info: JikanAnime | JikanManga): string {
    let html = `<div style="display: flex; border: 1px solid #ccc; border-radius: 5px; padding: 5px; margin: 5px; overflow: hidden;">`;
    
    if (info.images?.jpg?.image_url) {
        html += `<div style="flex: 0 0 auto; margin-right: 10px;">` +
            `<img src="${Chat.escapeHTML(info.images.jpg.image_url)}" alt="Cover Image" style="width: 100px; height: 150px;">` +
            `</div>`;
    }

    html += `<div style="flex: 1 1 auto; font-size: 0.9em;">` +
        `<strong>${Chat.escapeHTML(info.title)}${info.title_english ? ` / ${Chat.escapeHTML(info.title_english)}` : ''}</strong><br>` +
        `<strong>Status:</strong> ${Chat.escapeHTML(info.status || 'N/A')}<br>`;

    return html;
}

function buildMediaSpecificHtml(info: JikanAnime | JikanManga, type: 'anime' | 'manga'): string {
    if (type === 'anime') {
        const animeInfo = info as JikanAnime;
        let html = `<strong>Episodes:</strong> ${animeInfo.episodes || 'N/A'}<br>`;
        if (animeInfo.aired?.from) {
            html += `<strong>Release Date:</strong> ${new Date(animeInfo.aired.from).toLocaleDateString()}<br>`;
        }
        return html;
    } else {
        const mangaInfo = info as JikanManga;
        return `<strong>Chapters:</strong> ${mangaInfo.chapters || 'N/A'}<br>` +
            `<strong>Volumes:</strong> ${mangaInfo.volumes || 'N/A'}<br>`;
    }
}

function buildGenresHtml(info: JikanAnime | JikanManga): string {
    return info.genres?.length 
        ? `<strong>Genres:</strong> ${info.genres.map(g => Chat.escapeHTML(g.name)).join(', ')}<br>`
        : '';
}

function buildSynopsisHtml(info: JikanAnime | JikanManga, type: 'anime' | 'manga', truncateLength: number): string {
    if (!info.synopsis) return '';

    const truncated = info.synopsis.length > truncateLength;
    return `<strong>Synopsis:</strong> ${Chat.escapeHTML(info.synopsis.slice(0, truncateLength))}${truncated ? '... ' : ''}` +
        (truncated ? `<a href="https://myanimelist.net/${type}/${info.mal_id}" target="_blank">Read more</a>` : '') +
        `<br>`;
}

export const commands: Chat.Commands = {
    async anime(target, room, user) {
        if (!this.runBroadcast()) return;
        if (!target) return this.sendReply('Usage: /anime [anime name]');

        const [animeInfo] = await fetchJikanData<JikanAnime>('anime', target.trim());
        this.sendReplyBox(
            animeInfo 
                ? createDisplayBox(animeInfo, 'anime')
                : `No information found for '${Chat.escapeHTML(target)}'`
        );
    },

    async manga(target, room, user) {
        if (!this.runBroadcast()) return;
        if (!target) return this.sendReply('Usage: /manga [manga name]');

        const [mangaInfo] = await fetchJikanData<JikanManga>('manga', target.trim());
        this.sendReplyBox(
            mangaInfo
                ? createDisplayBox(mangaInfo, 'manga')
                : `No manga information found for '${Chat.escapeHTML(target)}'`
        );
    },

    async upcominganime(target, room, user) {
        if (!this.runBroadcast()) return;
        
        const genreQuery = target.trim().toLowerCase();
        const upcomingAnime = await fetchJikanData<JikanAnime>('anime');
        
        if (!upcomingAnime.length) {
            return this.sendReplyBox('No upcoming anime found.');
        }

        const filteredAnime = genreQuery
            ? upcomingAnime.filter(anime => anime.genres.some(g => g.name.toLowerCase() === genreQuery))
            : upcomingAnime;

        if (!filteredAnime.length) {
            return this.sendReplyBox(`No upcoming anime found with genre "${Chat.escapeHTML(genreQuery)}".`);
        }

        let html = `<div style="max-height: 350px; overflow-y: auto; border: 1px solid #ccc; border-radius: 5px; padding: 10px;">` +
            `<strong>Top Upcoming Anime${genreQuery ? ` in "${Chat.escapeHTML(genreQuery)}"` : ''}:</strong><br>`;
            
        html += filteredAnime.map((anime, i) => 
            createDisplayBox(anime, 'anime', 200) +
            (i < filteredAnime.length - 1 ? '<hr style="border: 0; border-top: 1px solid #ccc; margin: 10px 0;">' : '')
        ).join('');
            
        html += `</div>`;

        this.ImpulseReplyBox(html);
    },

    animemangahelp(target: string, room: ChatRoom | null, user: User) {
        if (!this.runBroadcast()) return;
        this.sendReplyBox(
            `<details><summary><b><center>Anime & Manga Commands By ${Impulse.nameColor('Prince Sky', true, true)}</center></b></summary>` +
            `<ul>` +
            `<li><code>/anime [name]</code> - Shows Information About Anime [name]</li>` +
            `<li><code>/manga [name]</code> - Shows Information About Manga [name]</li>` +
            `<li><code>/upcominganime</code> - Shows Top 5 Upcoming Animes</li>` +
            `</ul>` +
            `</details>`
        );
    },
};
