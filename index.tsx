import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Configuration ---
const getGenAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Types ---
type ViewState = 'DASHBOARD' | 'STUDIO';
type StudioTab = 'CONCEPT' | 'STRUCTURE' | 'LYRICS' | 'SOUND' | 'ART' | 'EXPORT';

interface ThemePack {
  title: string;
  topic: string;
  style: string;
}

interface ReferenceSuggestion {
  song: string;
  artist: string;
}

interface InstrumentPreset {
  name: string;
  instruments: string[];
}

interface Project {
  id: string;
  title: string;
  genre: string;
  subGenre: string;
  mood: string;
  styleDescription: string;
  bpm: number;
  key: string;
  createdAt: number;
  
  // Reference Song
  referenceSongTitle?: string;
  referenceArtist?: string;

  // Generated Content
  concept?: string;
  generatedTitles: string[];
  structure: SongBlock[];
  lyrics: string;
  excludedThemes?: string;
  sunoPrompt: string;
  coverImage?: string;
  compositionAdvice?: string; // AI Music Composition Suggestions
  
  // Lyric Ideas Persistence
  lyricVariations?: {title: string, lyrics: string, rationale: string}[];
  selectedLyricVariationIndex?: number | null;

  // Settings
  instruments: string[];
  vocalType: string;
  djName?: string;
  introStyle?: string;
}

interface SongBlock {
  id: string;
  type: string;
  description: string;
  duration: number;
}

interface SamplePrompt {
    label: string;
    text: string;
}

// --- Global Interface for AI Studio ---
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}

// --- Constants ---
const GENRES = [
  { label: 'Salsa', subgenres: ['Salsa Dura', 'Salsa Romántica', 'Salsa Urbana', 'Salsa Sensual', 'Timba (Cuban)', 'Salsa Funk', 'Salsa Mambo'] },
  { label: 'Bachata', subgenres: ['Bachata Moderna', 'Bachata Sensual', 'Bachata Dominicana', 'Bachata Tradicional', 'Bachata Fusion', 'Bachata Urban-Trap', 'Bachata Pop', 'Bachata Guajira', 'Bachata Remastered', 'Bachata Romántica'] },
  { label: 'Cha Cha', subgenres: ['Ballroom Cha Cha', 'Guajira', 'Boogaloo', 'Latin Pop'] },
  { label: 'Kizomba', subgenres: ['Traditional', 'Ghetto Zouk', 'Urban Kiz', 'Tarraxinha'] },
  { label: 'Merengue', subgenres: ['Merengue de Orquesta', 'Merengue Típico', 'Mambo', 'Techno Merengue'] },
  { label: 'Reggaeton', subgenres: ['Old School', 'Modern', 'Dembow'] },
  { label: 'Pop', subgenres: ['K-Pop', 'Synth Pop', 'Acoustic Pop'] },
  { label: 'EDM', subgenres: ['House', 'Techno', 'Trance'] },
  { label: 'Ballad', subgenres: ['Piano Ballad', 'Power Ballad', 'Rock Ballad'] },
  { label: 'Custom', subgenres: [] }
];

const MOODS = [
  'Happy & Energetic',
  'Romantic',
  'Passionate',
  'Party / Fiesta',
  'Chill & Relaxed',
  'Groovy',
  'Sexy & Sensual',
  'Traditional',
  'Emotional / Sad',
  'Modern & Stylish'
];

const INSTRUMENTS = [
  'Piano', 'Soft Piano', 'Synthesizer', 'Synth Pads', 'Organ',
  'Guitar', 'Requinto (Lead Guitar)', 'Rhythm Guitar', 'Acoustic Guitar', 'Electric Guitar FX', 'Bass', 'Strings',
  'Congas', 'Bongos', 'Timbales', 'Clave', 'Cowbell', 'Guiro', 'Guira', 'Maracas', 'Drums', 'Shaker', 'Tambora', 'Accordion',
  'Trumpet', 'Trombone', 'Saxophone', 'Brass Section',
  'Backing Vocals', 'Chorus', '808 Bass', 'Violin', 'Cello'
];

const INTRO_STYLES = [
  { id: '1', label: '부드러운 기타 (Classical)', desc: '가장 인기 많은 방식. 깨끗한 리드 기타가 분위기를 리드하며 안정감을 줌. (실패 없는 선택)', sunoTags: '[Clean Lead Guitar Intro], [Melodic Guitar Start], [Classical Bachata Style]' },
  { id: '2', label: '잔잔한 패드 + 기타 (Modern)', desc: '공기감 있는 신스 패드와 얇은 기타 라인. 몽환적이고 로맨틱한 분위기.', sunoTags: '[Dreamy Synth Pad Intro], [Soft Guitar Plucking], [Atmospheric Start], [Modern Romantic]' },
  { id: '3', label: 'Low Bass + 숨소리 (Sensual)', desc: '심장 같은 "쿵-" 베이스와 낮은 보컬 브레스. 섹시하고 텐션이 바로 올라감.', sunoTags: '[Deep Heartbeat Bass Intro], [Breathing ASMR], [Sensual Whisper], [Low Frequency Start]' },
  { id: '4', label: 'ASMR 속삭임 (Intimate)', desc: '귀에 가까운 속삭임, 손가락 튕김(Snap). 파트너와 거리가 좁아지는 느낌.', sunoTags: '[ASMR Whisper Intro], [Close Mic], [Intimate Sound], [Finger Snaps]' },
  { id: '5', label: 'Build-Up (Fade-in)', desc: '기타/패드/베이스가 서서히 커지며 몰입. 인스타 리믹스/DJ 버전 스타일.', sunoTags: '[Slow Fade-in], [Gradual Volume Rise], [Atmospheric Build-up]' },
  { id: '6', label: '딜레이 기타 + 리버브 (Dramatic)', desc: '여운이 긴 기타 소리와 공간감. 감정의 깊이를 자극하는 감성 스타일.', sunoTags: '[Heavy Reverb Guitar], [Delay Effect], [Dramatic Spacious Intro]' },
  { id: '7', label: '스토리 효과음 (Cinematic)', desc: '비, 바람, 파도, 도시 소음 등 환경음으로 시작. 영화적인 몰입감 유도.', sunoTags: '[Rain Sound Effect], [Ocean Waves], [Cinematic Intro], [Ambient Noise Start]' }
];

const ART_STYLES = [
  'Digital Art', 'Photorealistic', '3D Render', 'Oil Painting', 'Anime/Manga',
  'Watercolor', 'Cyberpunk', 'Steampunk', 'Synthwave', 'Vaporwave',
  'Pop Art', 'Minimalist', 'Abstract', 'Surrealism', 'Ukiyo-e',
  'Sketch/Pencil', 'Gothic', 'Renaissance', 'Pixel Art', 'Graffiti/Street Art'
];

const IMAGE_SIZE_PRESETS = [
    { id: 0, label: 'Square (1:1)', ratio: '1:1', desc: 'Instagram Feed, Profile' },
    { id: 1, label: 'Landscape (16:9)', ratio: '16:9', desc: 'YouTube, Web Banner' },
    { id: 2, label: 'Portrait (9:16)', ratio: '9:16', desc: 'Stories, Reels, TikTok' },
    { id: 3, label: 'Classic TV (4:3)', ratio: '4:3', desc: 'Retro, Tablet View' },
    { id: 4, label: 'Classic Photo (3:4)', ratio: '3:4', desc: 'Standard Print' },
    { id: 5, label: 'Social Post (4:5)', ratio: '3:4', desc: 'IG Portrait (Crop optimized)' },
    { id: 6, label: 'Wide Link (1.9:1)', ratio: '16:9', desc: 'FB/Twitter Link Preview' },
    { id: 7, label: 'Cinematic (21:9)', ratio: '16:9', desc: 'Ultra Widescreen Movie' },
    { id: 8, label: 'Tall Banner (1:2)', ratio: '9:16', desc: 'Vertical Display Ad' },
    { id: 9, label: 'Circular (1:1)', ratio: '1:1', desc: 'Sticker, Badge Style' }
];

// Helper to map UI ratio to API supported ratio
const getApiAspectRatio = (ratio: string) => {
    const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
    if (validRatios.includes(ratio)) return ratio;
    // Fallback mapping
    if (ratio === '4:5') return '3:4'; // Closest vertical
    if (ratio === '1.91:1') return '16:9'; // Closest landscape
    if (ratio === '21:9') return '16:9'; // Closest landscape
    if (ratio === '1:2') return '9:16'; // Closest vertical
    return '1:1';
};

const FONT_OPTIONS = [
    { label: 'Inter (Modern Standard)', value: "'Inter', sans-serif" },
    { label: 'Roboto (Clean)', value: "'Roboto', sans-serif" },
    { label: 'Open Sans (Neutral)', value: "'Open Sans', sans-serif" },
    { label: 'Montserrat (Geometric)', value: "'Montserrat', sans-serif" },
    { label: 'Poppins (Friendly)', value: "'Poppins', sans-serif" },
    { label: 'Lato (Stable)', value: "'Lato', sans-serif" },
    { label: 'Oswald (Tall & Bold)', value: "'Oswald', sans-serif" },
    { label: 'Anton (Impact)', value: "'Anton', sans-serif" },
    { label: 'Bebas Neue (Condensed)', value: "'Bebas Neue', cursive" },
    { label: 'Playfair Display (Elegant)', value: "'Playfair Display', serif" },
    { label: 'Merriweather (Readability)', value: "'Merriweather', serif" },
    { label: 'Abril Fatface (Big Serif)', value: "'Abril Fatface', cursive" },
    { label: 'Lobster (Retro Script)', value: "'Lobster', cursive" },
    { label: 'Pacifico (Fun Script)', value: "'Pacifico', cursive" },
    { label: 'Dancing Script (Handwritten)', value: "'Dancing Script', cursive" },
    { label: 'Permanent Marker (Marker)', value: "'Permanent Marker', cursive" }
];

const TEXT_EFFECT_OPTIONS = [
    { id: 'none', label: 'None (Clean)', style: {} },
    { id: 'shadow_soft', label: 'Soft Shadow', style: { textShadow: '2px 2px 4px rgba(0,0,0,0.5)' } },
    { id: 'shadow_hard', label: 'Hard Shadow', style: { textShadow: '3px 3px 0px rgba(0,0,0,0.8)' } },
    { id: 'outline_black', label: 'Outline (Black)', style: { WebkitTextStroke: '1px black', textShadow: '1px 1px 2px black' } },
    { id: 'outline_white', label: 'Outline (White)', style: { WebkitTextStroke: '1px white', color: '#000' } },
    { id: 'neon_pink', label: 'Neon Pink', style: { textShadow: '0 0 5px #fff, 0 0 10px #fff, 0 0 20px #e11d48, 0 0 30px #e11d48, 0 0 40px #e11d48' } },
    { id: 'neon_blue', label: 'Neon Blue', style: { textShadow: '0 0 5px #fff, 0 0 10px #fff, 0 0 20px #3b82f6, 0 0 30px #3b82f6, 0 0 40px #3b82f6' } },
    { id: 'glow_gold', label: 'Golden Glow', style: { textShadow: '0 0 10px #fbbf24, 0 0 20px #fbbf24' } },
    { id: 'retro_3d', label: 'Retro 3D', style: { textShadow: '2px 2px 0px #e11d48, 4px 4px 0px #3b82f6' } },
    { id: 'fire', label: 'Fire', style: { textShadow: '0 -1px 2px #fff, 2px -2px 5px #fbbf24, -2px -4px 10px #ef4444, 0 -8px 15px #ea580c' } },
    { id: 'ice', label: 'Ice', style: { textShadow: '0 0 2px #fff, 0 0 5px #bae6fd, 0 0 10px #0ea5e9' } },
    { id: 'cyberpunk', label: 'Cyberpunk', style: { textShadow: '2px 0px 0px #ef4444, -2px 0px 0px #3b82f6', fontStyle: 'italic' } },
    { id: 'heavy_metal', label: 'Heavy Metal', style: { textShadow: '0 1px 0 #ccc, 0 2px 0 #c9c9c9, 0 3px 0 #bbb, 0 4px 0 #b9b9b9, 0 5px 0 #aaa, 0 6px 1px rgba(0,0,0,.1), 0 0 5px rgba(0,0,0,.1), 0 1px 3px rgba(0,0,0,.3), 0 3px 5px rgba(0,0,0,.2), 0 5px 10px rgba(0,0,0,.25), 0 10px 10px rgba(0,0,0,.2), 0 20px 20px rgba(0,0,0,.15)' } },
    { id: 'vintage', label: 'Vintage Letterpress', style: { color: 'rgba(255,255,255,0.8)', textShadow: '1px 1px 1px rgba(0,0,0,0.8), -1px -1px 1px rgba(255,255,255,0.3)' } },
    { id: 'emboss', label: 'Embossed', style: { color: '#eee', textShadow: '-1px -1px 1px rgba(255,255,255,0.3), 1px 1px 1px rgba(0,0,0,0.5)' } },
    { id: 'mirror', label: 'Reflection', style: { textShadow: '0px 10px 5px rgba(255,255,255,0.3)' } },
    { id: 'elegant', label: 'Elegant Blur', style: { textShadow: '0 0 4px rgba(255,255,255,0.8)' } },
    { id: 'pop_art', label: 'Pop Art', style: { WebkitTextStroke: '2px black', textShadow: '4px 4px 0px #fbbf24' } },
    { id: 'hollow', label: 'Hollow', style: { WebkitTextStroke: '1px white', color: 'transparent' } },
    { id: 'glitch', label: 'Glitchy', style: { textShadow: '3px 0 #ff00ff, -3px 0 #00ffff' } }
];

const CHARACTER_SAMPLES = [
  'Dancing Couple', 'Lonely Silhouette', 'Futuristic Robot', 'Cat DJ',
  'Tropical Beach', 'Neon Cityscape', 'Abstract Shapes', 'Ancient Warrior',
  'Space Astronaut', 'Blooming Flower', 'Crowded Club', 'Rainy Window'
];

const DEFAULT_ARTISTS = ['DJ Doberman', 'MC Sola', 'Luna'];

const GENRE_DEFAULTS: Record<string, string[]> = {
  'Salsa': [
    'Congas', 'Bongos', 'Timbales', 'Clave', 'Bass', 'Piano', 
    'Trumpet', 'Trombone', 'Saxophone', 'Cowbell', 'Guiro', 'Maracas', 'Backing Vocals'
  ],
  'Bachata': [
    'Requinto (Lead Guitar)', 'Rhythm Guitar', 'Bass', 'Bongos', 
    'Guira', 'Strings', 'Synth Pads', 'Soft Piano', 'Electric Guitar FX'
  ],
  'Cha Cha': [
    'Guiro', 'Congas', 'Timbales (Cha Cha Bell)', 'Piano', 'Bass', 'Cowbell', 'Brass Section', 'Flute'
  ],
  'Kizomba': [
    'Synthesizer', 'Zouk Beat (Drums)', 'Deep Bass', 'Synth Pads', 'Electric Guitar', 'Vocals'
  ],
  'Merengue': [
    'Tambora', 'Guira', 'Accordion', 'Saxophone', 'Trumpet', 'Bass', 'Piano'
  ],
  'Reggaeton': ['Synthesizer', 'Dembow Beat (Drums)', 'Deep Bass', 'Piano'],
  'Pop': ['Drums', 'Bass', 'Synthesizer', 'Guitar', 'Piano', 'Backing Vocals'],
  'EDM': ['Synthesizer', 'Drum Machine', 'Bass', 'FX', 'Piano'],
  'Ballad': ['Piano', 'Strings', 'Acoustic Guitar', 'Bass'],
  'Custom': ['Drums', 'Bass', 'Piano', 'Synthesizer']
};

const BLOCK_SAMPLES: Record<string, string[]> = {
  'Intro': [
    'Percussion Intro (Dance Friendly)',
    'Full Band Hit (Immediate Start)',
    'Count-in (1-2-3-4)',
    'Instrumental Hook Intro',
    'DJ Friendly Intro (Percussion only)',
    'Piano Montuno & Percussion'
  ],
  'Verse': [
    'Story begins, rhythmic flow',
    'Melodic storytelling (On-beat)',
    'Rap verse with minimal beat',
    'Building tension',
    'Main Groove (Tight, Elegant)'
  ],
  'Chorus': [
    'Main hook, high energy',
    'Anthemic sing-along',
    'Catchy melody repetition',
    'Harmonized vocals',
    'Powerful drop lead-in',
    'Brass Theme (Short Punchy Phrases)'
  ],
  'Bridge': [
    'Emotional slowdown',
    'Key change transition',
    'Instrumental breakdown',
    'Acapella section',
    'Build up to final chorus',
    'Montuno (Call & Response)'
  ],
  'Drop': [
    'High energy dance section',
    'Heavy bass drop',
    'Synth lead solo',
    'Percussion break',
    'Break + Sharp Brass HIT',
    'Tarraxinha (Bass Focus)'
  ],
  'Instrumental': [
    'Guitar Solo',
    'Piano Montuno',
    'Brass Mambo Section',
    'Synth Lead Solo',
    'Percussion Break',
    'Montuno 2 (Peak Energy)',
    'Jaleo (High Energy Brass)'
  ],
  'Outro': [
    'Fade out',
    'Repeat chorus line',
    'Instrumental solo finish',
    'Abrupt ending',
    'DJ Friendly Outro (Beat loop)',
    'Clean Ending (Piano + Percussion)'
  ]
};

const DEFAULT_SAMPLE_PROMPTS = [
  {
    label: "💛 Sensual Bachata",
    text: "[Percussive Intro], [Steady Beat], Sensual bachata, 72 BPM, key B minor, Smooth requinto guitar, soft 808 bass, warm pad chords, gentle percussion, deep reverb. Modern bachata groove. Perfect for sensual dancing."
  },
  {
    label: "💙 Urban Bachata",
    text: "[Percussive Intro], [Steady Beat], Urban bachata, 74 BPM, key A minor. Electric guitar riff, 808 sub bass, rhythmic hihats, trap-influenced drums, smooth R&B pads, clean mix, energetic drop. Modern city-night bachata style."
  },
  {
    label: "🤎 Romantic Traditional Mix",
    text: "[Percussive Intro], [Steady Beat], Romantic modern-traditional bachata, 86 BPM, key D minor. Requinto melody, acoustic rhythm guitar, bongo and güira, warm bass guitar, soft pads for atmosphere. Clean, emotional, classic dance-floor vibe."
  },
  {
    label: "🗽 Classic NY Mambo Break Edition",
    text: "New York ON2 salsa with bright brass, sharp piano montuno, deep congas, and timbales. Add a dancer-friendly structure: intro → main groove → musical break → mambo horns. Include call-and-response between brass and piano. Tight rhythm, energetic, perfect for social dancing. BPM 94, Key Am."
  },
  {
    label: "💃 NY Mambo (ON2 Friendly)",
    text: "[Percussive Intro], [Steady Beat], New York Mambo, 92 BPM, Key Am. Elegant and rhythmic. Piano montuno, light conga, bongo, clave. Strict metronomic timing. Classic brass hits. Clean ending. No pop influence."
  }
];

const STRUCTURE_TEMPLATES = {
  'Custom': [],
  'Cha Cha: Ballroom Classic': [
      { type: 'Intro', description: 'Percussion & Cowbell Start (4 bars)', duration: 4 },
      { type: 'Verse', description: 'Playful Vocals', duration: 16 },
      { type: 'Chorus', description: 'Catchy Hook', duration: 8 },
      { type: 'Instrumental', description: 'Break (Stop & Go)', duration: 4 },
      { type: 'Verse', description: 'Verse 2', duration: 16 },
      { type: 'Chorus', description: 'Main Hook', duration: 8 },
      { type: 'Bridge', description: 'Piano Montuno', duration: 8 },
      { type: 'Chorus', description: 'Final Hook', duration: 8 },
      { type: 'Outro', description: 'Clean Finish (Cha-cha-cha)', duration: 4 }
  ],
  'Cha Cha: Latin Pop': [
      { type: 'Intro', description: 'Pop Synth & Percussion', duration: 8 },
      { type: 'Verse', description: 'Pop Style Verse', duration: 16 },
      { type: 'Chorus', description: 'Anthemic Chorus', duration: 8 },
      { type: 'Verse', description: 'Verse 2', duration: 16 },
      { type: 'Chorus', description: 'Anthemic Chorus', duration: 8 },
      { type: 'Instrumental', description: 'Guitar/Synth Solo', duration: 8 },
      { type: 'Chorus', description: 'Final Chorus', duration: 8 },
      { type: 'Outro', description: 'Fade out', duration: 8 }
  ],
  'Kizomba: Traditional Flow': [
      { type: 'Intro', description: 'Beat start (Strong 1)', duration: 8 },
      { type: 'Verse', description: 'Storytelling (Smooth)', duration: 16 },
      { type: 'Chorus', description: 'Melodic Hook', duration: 8 },
      { type: 'Verse', description: 'Verse 2', duration: 16 },
      { type: 'Chorus', description: 'Melodic Hook', duration: 8 },
      { type: 'Instrumental', description: 'Guitar/Synth Melody', duration: 8 },
      { type: 'Chorus', description: 'Final Hook', duration: 8 },
      { type: 'Outro', description: 'Beat loop fade', duration: 8 }
  ],
  'Kizomba: Urban / Ghetto Zouk': [
      { type: 'Intro', description: 'Atmospheric & Bass', duration: 8 },
      { type: 'Verse', description: 'R&B Style Vocals', duration: 16 },
      { type: 'Chorus', description: 'Catchy Hook', duration: 8 },
      { type: 'Drop', description: 'Tarraxinha (Bass Focus)', duration: 8 },
      { type: 'Verse', description: 'Verse 2', duration: 16 },
      { type: 'Chorus', description: 'Hook', duration: 8 },
      { type: 'Drop', description: 'Tarraxinha (Heavier Bass)', duration: 8 },
      { type: 'Outro', description: 'Fade out', duration: 8 }
  ],
  'Merengue: Orquesta (High Energy)': [
      { type: 'Intro', description: 'Explosive Brass (Jaleo)', duration: 8 },
      { type: 'Verse', description: 'Fast Paced Singing', duration: 16 },
      { type: 'Chorus', description: 'Call & Response (Coro)', duration: 8 },
      { type: 'Verse', description: 'Verse 2', duration: 16 },
      { type: 'Chorus', description: 'Call & Response', duration: 8 },
      { type: 'Instrumental', description: 'Mambo (Saxophone Solo)', duration: 16 },
      { type: 'Instrumental', description: 'Jaleo (Brass Climax)', duration: 8 },
      { type: 'Outro', description: 'Tight Ending', duration: 4 }
  ],
  'Merengue: Típico (Accordion)': [
      { type: 'Intro', description: 'Paseo (Accordion Walk)', duration: 8 },
      { type: 'Verse', description: 'Traditional Singing', duration: 16 },
      { type: 'Chorus', description: 'Coro', duration: 8 },
      { type: 'Instrumental', description: 'Accordion Solo (Fast)', duration: 16 },
      { type: 'Chorus', description: 'Coro', duration: 8 },
      { type: 'Bridge', description: 'Percussion Break', duration: 4 },
      { type: 'Instrumental', description: 'Jaleo (Fast)', duration: 16 },
      { type: 'Outro', description: 'Accordion Finish', duration: 4 }
  ],
  'Standard Pop (3:00)': [
    { type: 'Intro', description: 'Instrumental build up', duration: 4 },
    { type: 'Verse', description: 'Story begins', duration: 16 },
    { type: 'Chorus', description: 'Main hook', duration: 8 },
    { type: 'Verse', description: 'Story develops', duration: 16 },
    { type: 'Chorus', description: 'Main hook', duration: 8 },
    { type: 'Bridge', description: 'Emotional peak', duration: 8 },
    { type: 'Chorus', description: 'Final powerful hook', duration: 8 },
    { type: 'Outro', description: 'Fade out', duration: 4 }
  ],
  'Hip-Hop / Rap (2:30)': [
    { type: 'Intro', description: 'Beat start', duration: 4 },
    { type: 'Chorus', description: 'Main Hook', duration: 8 },
    { type: 'Verse', description: 'Verse 1 (16 bars)', duration: 16 },
    { type: 'Chorus', description: 'Hook', duration: 8 },
    { type: 'Verse', description: 'Verse 2 (16 bars)', duration: 16 },
    { type: 'Chorus', description: 'Hook', duration: 8 },
    { type: 'Outro', description: 'Fade out', duration: 4 }
  ],
  'Viral Short (TikTok)': [
    { type: 'Chorus', description: 'Hook immediately', duration: 8 },
    { type: 'Verse', description: 'Quick context', duration: 8 },
    { type: 'Chorus', description: 'Hook repetition', duration: 8 }
  ],
  'Extended Club Mix': [
    { type: 'Intro', description: 'DJ Intro (Percussion)', duration: 8 },
    { type: 'Verse', description: 'Minimal vocals', duration: 8 },
    { type: 'Drop', description: 'Main Drop', duration: 8 },
    { type: 'Bridge', description: 'Breakdown', duration: 8 },
    { type: 'Drop', description: 'Second Drop', duration: 8 },
    { type: 'Outro', description: 'DJ Outro', duration: 8 }
  ],
  'Salsa On2 (Classic)': [
    { type: 'Intro', description: 'Percussion & Brass buildup', duration: 8 },
    { type: 'Verse', description: 'Cuerpo (Storytelling)', duration: 16 },
    { type: 'Chorus', description: 'Coro (Main Hook)', duration: 8 },
    { type: 'Verse', description: 'Cuerpo (Development)', duration: 16 },
    { type: 'Chorus', description: 'Coro (Main Hook)', duration: 8 },
    { type: 'Bridge', description: 'Montuno (Call & Response)', duration: 16 },
    { type: 'Instrumental', description: 'Mambo (Horn Section)', duration: 8 },
    { type: 'Chorus', description: 'Coro Final', duration: 8 },
    { type: 'Outro', description: 'Moña & Fade out', duration: 8 }
  ],
  'Salsa Dura (Heavy Brass)': [
    { type: 'Intro', description: 'Powerful Brass & Percussion Hit', duration: 8 },
    { type: 'Verse', description: 'Cuerpo (Storytelling)', duration: 16 },
    { type: 'Chorus', description: 'Coro (Main Hook)', duration: 8 },
    { type: 'Verse', description: 'Cuerpo (Development)', duration: 16 },
    { type: 'Chorus', description: 'Coro', duration: 8 },
    { type: 'Bridge', description: 'Montuno (Call & Response)', duration: 16 },
    { type: 'Instrumental', description: 'Mambo (Horn Section Solo)', duration: 8 },
    { type: 'Instrumental', description: 'Percussion Solo (Timbales)', duration: 8 },
    { type: 'Chorus', description: 'Coro Final', duration: 8 },
    { type: 'Outro', description: 'Moña (Instrumental Brass Break)', duration: 8 }
  ],
  'Salsa Romántica (Melodic)': [
    { type: 'Intro', description: 'Soft Piano & Saxophone', duration: 8 },
    { type: 'Verse', description: 'Romantic Vocals (Verse 1)', duration: 16 },
    { type: 'Chorus', description: 'Catchy Melodic Hook', duration: 8 },
    { type: 'Verse', description: 'Romantic Vocals (Verse 2)', duration: 16 },
    { type: 'Chorus', description: 'Catchy Melodic Hook', duration: 8 },
    { type: 'Bridge', description: 'Emotional Build-up', duration: 8 },
    { type: 'Chorus', description: 'Final Hook', duration: 8 },
    { type: 'Outro', description: 'Smooth Fade Out', duration: 8 }
  ],
  'Salsa Urbana (Modern)': [
    { type: 'Intro', description: 'Synth & Beat Intro', duration: 4 },
    { type: 'Verse', description: 'R&B Style Vocals', duration: 16 },
    { type: 'Chorus', description: 'Pop-influenced Hook', duration: 8 },
    { type: 'Verse', description: 'Rap/Flow Section', duration: 16 },
    { type: 'Chorus', description: 'Hook', duration: 8 },
    { type: 'Drop', description: 'Dance Break (Urban Beat)', duration: 8 },
    { type: 'Chorus', description: 'Final Hook', duration: 8 },
    { type: 'Outro', description: 'DJ Style Outro', duration: 4 }
  ],
  'Salsa Sensual': [
    { type: 'Intro', description: 'Atmospheric Pads & Piano', duration: 8 },
    { type: 'Verse', description: 'Soft & Breath-y Vocals', duration: 16 },
    { type: 'Chorus', description: 'Melodic Hook', duration: 8 },
    { type: 'Instrumental', description: 'Smooth Body Roll Section', duration: 8 },
    { type: 'Verse', description: 'Building Passion', duration: 16 },
    { type: 'Chorus', description: 'Final Hook', duration: 8 },
    { type: 'Outro', description: 'Gentle End', duration: 8 }
  ],
  'Timba (Cuban Style)': [
    { type: 'Intro', description: 'Complex Rhythmic Intro', duration: 8 },
    { type: 'Verse', description: 'Tema (Main Theme)', duration: 16 },
    { type: 'Chorus', description: 'Coro', duration: 8 },
    { type: 'Instrumental', description: 'Bloque (Rhythmic Break)', duration: 4 },
    { type: 'Bridge', description: 'Montuno 1 (Call & Response)', duration: 16 },
    { type: 'Drop', description: 'Despelote (Funky/Polyrythmic)', duration: 8 },
    { type: 'Bridge', description: 'Montuno 2 (Higher Energy)', duration: 16 },
    { type: 'Outro', description: 'Coda (Big Finish)', duration: 8 }
  ],
  'Salsa Funk/Fusion': [
    { type: 'Intro', description: 'Funky Bass & Guitar Riff', duration: 8 },
    { type: 'Verse', description: 'Groovy Vocals', duration: 16 },
    { type: 'Chorus', description: 'Energetic Hook', duration: 8 },
    { type: 'Instrumental', description: 'Funk Break (Bass Solo)', duration: 8 },
    { type: 'Bridge', description: 'Montuno with Rock Guitar', duration: 16 },
    { type: 'Chorus', description: 'Final Hook', duration: 8 },
    { type: 'Outro', description: 'Jam Session Fade', duration: 8 }
  ],
  'Salsa Mambo (New York Style)': [
    { type: 'Intro', description: 'Jazz-influenced Brass Intro', duration: 8 },
    { type: 'Verse', description: 'Cuerpo (Storytelling)', duration: 16 },
    { type: 'Chorus', description: 'Coro (Main Hook)', duration: 8 },
    { type: 'Verse', description: 'Cuerpo (Development)', duration: 16 },
    { type: 'Chorus', description: 'Coro', duration: 8 },
    { type: 'Bridge', description: 'Montuno (Piano/Bongo focus)', duration: 16 },
    { type: 'Instrumental', description: 'Mambo Section (Complex Brass)', duration: 16 },
    { type: 'Instrumental', description: 'Moña (Improvised Brass)', duration: 8 },
    { type: 'Chorus', description: 'Coro Final', duration: 8 },
    { type: 'Outro', description: 'Sharp Jazz Finish', duration: 4 }
  ],
  'New York Mambo (ON2 Friendly)': [
    { type: 'Intro', description: 'Piano Montuno & Percussion (Clear Timing)', duration: 4 },
    { type: 'Verse', description: 'Main Groove (Tight, Elegant)', duration: 16 },
    { type: 'Chorus', description: 'Brass Theme (Short Punchy Phrases)', duration: 8 },
    { type: 'Verse', description: 'Groove Variation (Steady Piano)', duration: 8 },
    { type: 'Bridge', description: 'Montuno 1 (Call & Response)', duration: 8 },
    { type: 'Drop', description: 'Break + Sharp Brass HIT', duration: 4 },
    { type: 'Instrumental', description: 'Montuno 2 (Peak Energy)', duration: 16 },
    { type: 'Outro', description: 'Clean Ending (Piano + Percussion)', duration: 8 }
  ],
  'Bachata: Modern Sensual': [
    { type: 'Intro', description: 'Requinto melodic solo', duration: 8 },
    { type: 'Verse', description: 'Soft vocals, romantic', duration: 16 },
    { type: 'Chorus', description: 'Catchy Hook', duration: 8 },
    { type: 'Verse', description: 'Building tension', duration: 16 },
    { type: 'Chorus', description: 'Catchy Hook', duration: 8 },
    { type: 'Instrumental', description: 'Mambo (Guitar Solo)', duration: 8 },
    { type: 'Drop', description: 'Bass & Percussion Break', duration: 4 },
    { type: 'Chorus', description: 'Final Hook', duration: 8 },
    { type: 'Outro', description: 'Guitar fade out', duration: 4 }
  ],
  'Bachata: Classic Sensual': [
    { type: 'Intro', description: 'Simple & Romantic (Soft)', duration: 8 },
    { type: 'Verse', description: 'Emotional Storytelling', duration: 16 },
    { type: 'Chorus', description: 'Melodic Hook', duration: 8 },
    { type: 'Verse', description: 'Story Deepens', duration: 16 },
    { type: 'Chorus', description: 'Melodic Hook', duration: 8 },
    { type: 'Bridge', description: 'Smooth Transition', duration: 8 },
    { type: 'Chorus', description: 'Final Hook', duration: 8 },
    { type: 'Outro', description: 'Gentle Fade', duration: 4 }
  ],
  'Bachata: Fusion (Zouk/R&B)': [
    { type: 'Intro', description: 'Atmospheric Synth Start', duration: 8 },
    { type: 'Verse', description: 'R&B Style Vocals', duration: 16 },
    { type: 'Chorus', description: 'Hook with Bass Drop', duration: 8 },
    { type: 'Instrumental', description: 'Body Roll Section (Beat Stop)', duration: 4 },
    { type: 'Verse', description: 'Building Tension', duration: 8 },
    { type: 'Chorus', description: 'Explosive Hook', duration: 8 },
    { type: 'Bridge', description: 'Zouk Flow (Fluid rhythm)', duration: 8 },
    { type: 'Outro', description: 'Slow fade', duration: 8 }
  ],
  'Bachata: Urban (Hip-Hop)': [
    { type: 'Intro', description: 'Heavy Bass & Trap Hat hints', duration: 4 },
    { type: 'Verse', description: 'Rap/Singing Flow (Swag)', duration: 16 },
    { type: 'Chorus', description: 'Catchy & Rhythmic Hook', duration: 8 },
    { type: 'Verse', description: 'Dynamic Verse (Accents)', duration: 16 },
    { type: 'Chorus', description: 'Hook', duration: 8 },
    { type: 'Drop', description: 'Street Style Drop (Heavy Beat)', duration: 8 },
    { type: 'Outro', description: 'Abrupt Finish or DJ Loop', duration: 4 }
  ],
  'Bachata: Latin Pop': [
    { type: 'Intro', description: 'Pop Synth Intro', duration: 4 },
    { type: 'Verse', description: 'Pop Vocal Melody', duration: 8 },
    { type: 'Chorus', description: 'Anthemic Hook (Sing-along)', duration: 8 },
    { type: 'Verse', description: 'Verse 2', duration: 8 },
    { type: 'Chorus', description: 'Anthemic Hook', duration: 8 },
    { type: 'Bridge', description: 'Dreamy Vocal Layering', duration: 8 },
    { type: 'Chorus', description: 'Final Powerful Chorus', duration: 8 },
    { type: 'Outro', description: 'Radio Edit Fade', duration: 4 }
  ],
  'Bachata: Deep Passion (Erotic)': [
    { type: 'Intro', description: 'Minimalist, Breathing, Close Mic', duration: 8 },
    { type: 'Verse', description: 'Whisper Vocals, Slow build', duration: 16 },
    { type: 'Chorus', description: 'Deep Emotional Hook (Low energy)', duration: 8 },
    { type: 'Verse', description: 'Intimate Storytelling', duration: 16 },
    { type: 'Bridge', description: 'Silence / Heartbeat / Tension', duration: 4 },
    { type: 'Chorus', description: 'Deep Hook', duration: 8 },
    { type: 'Outro', description: 'Lingering Note', duration: 8 }
  ],
  'Bachata: Slow Flow': [
    { type: 'Intro', description: 'Very Slow, Melodic (105 BPM style)', duration: 8 },
    { type: 'Verse', description: 'Long drawn-out notes', duration: 16 },
    { type: 'Chorus', description: 'Wave-like flow', duration: 16 },
    { type: 'Instrumental', description: 'Slow Guitar & Isolations', duration: 8 },
    { type: 'Chorus', description: 'Emotional Peak', duration: 16 },
    { type: 'Outro', description: 'Gentle ending', duration: 8 }
  ]
};

const GENRE_PRESETS: Record<string, { label: string, bpm: number, key: string, instruments?: string[] }[]> = {
  'Salsa': [
    { label: '🔥 Salsa Dura (Fast & Aggressive)', bpm: 180, key: 'Am', instruments: ['Trumpet', 'Trombone', 'Timbales', 'Congas', 'Piano', 'Bass'] },
    { label: '❤️ Salsa Romántica (Medium)', bpm: 90, key: 'Cm', instruments: ['Piano', 'Synthesizer', 'Trombone', 'Congas', 'Guiro', 'Backing Vocals'] },
    { label: '🇨🇺 Timba (Cuban Style)', bpm: 98, key: 'Gm', instruments: ['Drums', 'Timbales', 'Bass', 'Piano', 'Brass Section'] },
    { label: '🎸 Son Montuno (Traditional)', bpm: 82, key: 'Dm', instruments: ['Acoustic Guitar', 'Bongos', 'Trumpet', 'Bass', 'Clave'] },
    { label: '🏙️ Salsa Urbana (Modern)', bpm: 95, key: 'Fm', instruments: ['Synthesizer', 'Drum Machine', 'Trombone', 'Congas', 'Piano'] },
    { label: '🇨🇴 Salsa Colombiana (Fast)', bpm: 190, key: 'Em', instruments: ['Fast Piano', 'Trumpet', 'Cowbell', 'Congas', 'Timbales'] },
    { label: '🕺 Boogaloo (60s NYC)', bpm: 120, key: 'G', instruments: ['Piano', 'Hand Claps', 'Trumpet', 'Bass', 'Timbales'] },
    { label: '🌊 Salsa Choke (Urban/Pacific)', bpm: 110, key: 'Bm', instruments: ['Marimba', 'Urban Beats', 'Congas', 'Synthesizer'] },
    { label: '🎷 Latin Jazz Salsa', bpm: 160, key: 'Dm', instruments: ['Saxophone', 'Trumpet', 'Double Bass', 'Piano', 'Congas'] },
    { label: '🗽 Mambo (On2 NYC Style)', bpm: 140, key: 'Cm', instruments: ['Vibraphone', 'Timbales', 'Congas', 'Bongos', 'Bass', 'Piano'] }
  ],
  'Bachata': [
    { label: '🇩🇴 Dominican Bachata (Traditional)', bpm: 135, key: 'Bm', instruments: ['Requinto (Lead Guitar)', 'Rhythm Guitar', 'Bongos', 'Guira', 'Bass'] },
    { label: '💖 Sensual Bachata (Modern)', bpm: 108, key: 'Am', instruments: ['Synthesizer', 'Synth Pads', 'Requinto (Lead Guitar)', 'Bass', 'Bongos'] },
    { label: '🏙️ Urban Bachata (Pop Fusion)', bpm: 118, key: 'Em', instruments: ['Electric Guitar FX', 'Synthesizer', 'Drum Machine', 'Bass'] },
    { label: '🌹 Bachata Rosa (90s Romantic)', bpm: 125, key: 'Dm', instruments: ['Acoustic Guitar', 'Bongos', 'Guira', 'Synth Strings', 'Bass'] },
    { label: '🤠 Bachata Guajira (Country Style)', bpm: 115, key: 'G', instruments: ['Requinto', 'Accordion', 'Bongos', 'Guira', 'Bass'] },
    { label: '🤖 Tech-Bachata (Electronic)', bpm: 110, key: 'Fm', instruments: ['Synthesizer', 'Electronic Drums', 'Requinto', 'Deep Bass'] },
    { label: '🌑 Dark Bachata (Moody)', bpm: 105, key: 'C#m', instruments: ['Distorted Guitar', 'Atmospheric Pads', 'Heavy Bass', 'Bongos'] },
    { label: '🎸 Acoustic Bachata (Unplugged)', bpm: 112, key: 'E', instruments: ['Acoustic Guitar', 'Cajon', 'Shaker', 'Double Bass'] },
    { label: '📻 Pop Bachata (Radio Friendly)', bpm: 120, key: 'C', instruments: ['Electric Guitar', 'Piano', 'Drums', 'Guira', 'Bass'] },
    { label: '💃 Bachata Tango (Fusion)', bpm: 115, key: 'Gm', instruments: ['Bandoneon', 'Requinto', 'Violin', 'Piano', 'Bass'] }
  ],
  'Cha Cha': [
    { label: '💃 Ballroom Cha Cha (Strict)', bpm: 120, key: 'Gm', instruments: ['Guiro', 'Cowbell', 'Congas', 'Piano', 'Brass Section'] },
    { label: '🎤 Latin Pop Cha Cha', bpm: 115, key: 'Dm', instruments: ['Drums', 'Synthesizer', 'Electric Guitar', 'Bass'] },
    { label: '🌴 Guajira Cha Cha (Slow)', bpm: 105, key: 'Am', instruments: ['Flute', 'Violin', 'Acoustic Guitar', 'Guiro', 'Congas'] },
    { label: '🕺 Boogaloo Cha Cha (Funky)', bpm: 125, key: 'F', instruments: ['Piano', 'Trumpet', 'Hand Claps', 'Bass', 'Timbales'] },
    { label: '🇨🇺 Cuban Cha Cha Chá (Traditional)', bpm: 118, key: 'D', instruments: ['Flute', 'Violins', 'Piano', 'Timbales', 'Guiro'] },
    { label: '🎸 Rock Cha Cha (Santana Style)', bpm: 122, key: 'Am', instruments: ['Electric Guitar', 'Hammond Organ', 'Drums', 'Congas', 'Cowbell'] },
    { label: '⚡ Electro Cha Cha', bpm: 124, key: 'Cm', instruments: ['Synthesizer', 'Drum Machine', 'Cowbell', 'Bass', 'FX'] },
    { label: '🍸 Lounge Cha Cha', bpm: 110, key: 'Em', instruments: ['Vibraphone', 'Soft Drums', 'Double Bass', 'Piano'] },
    { label: '🎷 Jazz Cha Cha', bpm: 116, key: 'Bb', instruments: ['Saxophone', 'Piano', 'Double Bass', 'Drums', 'Congas'] },
    { label: '🎺 Big Band Cha Cha', bpm: 126, key: 'Eb', instruments: ['Brass Section', 'Saxophone Section', 'Piano', 'Drums', 'Double Bass'] }
  ],
  'Kizomba': [
    { label: '🇦🇴 Traditional Kizomba (Angola)', bpm: 85, key: 'Cm', instruments: ['Synthesizer', 'Drums', 'Bass', 'Electric Guitar'] },
    { label: '🎧 Ghetto Zouk / Tarraxinha', bpm: 90, key: 'Bbm', instruments: ['Deep Bass', 'Synthesizer', 'Drum Machine', 'FX'] },
    { label: '🌆 Urban Kiz (Modern)', bpm: 80, key: 'Fm', instruments: ['Synth Pads', 'Deep Bass', 'Electronic Drums', 'Piano'] },
    { label: '💞 Kizomba Fusion (R&B)', bpm: 82, key: 'Am', instruments: ['Soft Piano', 'Synth Pads', 'Snap', 'Deep Bass'] },
    { label: '🏃 Semba (Fast/Roots)', bpm: 105, key: 'G', instruments: ['Acoustic Guitar', 'Percussion', 'Bass', 'Trumpet'] },
    { label: '🐌 Tarraxa (Slow Bass)', bpm: 75, key: 'Dm', instruments: ['Sub Bass', 'Minimal Drums', 'Atmospheric FX'] },
    { label: '🏠 Afro-House Fusion', bpm: 120, key: 'Em', instruments: ['Heavy Drums', 'Shaker', 'Synthesizer', 'Chanting Vocals'] },
    { label: '🔊 Zouk Bass (Club)', bpm: 95, key: 'Gm', instruments: ['Distorted Bass', 'Drop Synth', 'Heavy Kick'] },
    { label: '🎸 Acoustic Kizomba', bpm: 84, key: 'D', instruments: ['Acoustic Guitar', 'Cajon', 'Shaker', 'Bass'] },
    { label: '🎻 Instrumental Kizomba', bpm: 80, key: 'Bm', instruments: ['Violin', 'Piano', 'Synth Pads', 'Zouk Beat'] }
  ],
  'Merengue': [
    { label: '🎺 Merengue de Orquesta (80s)', bpm: 150, key: 'C', instruments: ['Trumpet', 'Saxophone', 'Tambora', 'Guira', 'Piano', 'Bass'] },
    { label: '🪗 Merengue Típico (Accordion)', bpm: 160, key: 'G', instruments: ['Accordion', 'Tambora', 'Guira', 'Bass', 'Saxophone'] },
    { label: '🕺 Mambo Merengue', bpm: 140, key: 'Am', instruments: ['Brass Section', 'Piano', 'Drums', 'Bass'] },
    { label: '💻 Techno Merengue', bpm: 145, key: 'F', instruments: ['Synthesizer', 'Drum Machine', 'Sequencer', 'Tambora'] },
    { label: '🏠 Merengue House (90s)', bpm: 135, key: 'Dm', instruments: ['House Beat', 'Piano Montuno', 'Tambora', 'Vocals'] },
    { label: '🏙️ Merengue Urbano', bpm: 130, key: 'Em', instruments: ['Reggaeton Beat', 'Synthesizer', 'Tambora', 'Guira'] },
    { label: '🐢 Pambiche (Slow Traditional)', bpm: 120, key: 'D', instruments: ['Accordion', 'Tambora', 'Guira', 'Bass'] },
    { label: '❤️ Merengue Romántico', bpm: 125, key: 'Bb', instruments: ['Soft Synth', 'Piano', 'Saxophone', 'Tambora', 'Bass'] },
    { label: '⚡ Electro Mambo', bpm: 155, key: 'Gm', instruments: ['Electronic Drums', 'Fast Piano', 'Brass Synths', 'Bass'] },
    { label: '🎭 Carnival Merengue (Fastest)', bpm: 170, key: 'C', instruments: ['Whistle', 'Marching Drums', 'Trumpet', 'Trombone', 'Saxophone'] }
  ],
  'Reggaeton': [
    { label: '🧢 Old School (Dembow)', bpm: 94, key: 'Am', instruments: ['Synthesizer', 'Drums', 'Bass'] },
    { label: '⛓️ Modern Reggaeton', bpm: 90, key: 'Em', instruments: ['Synthesizer', 'Synth Pads', 'Deep Bass', 'FX'] },
    { label: '🌑 Dark Reggaeton (Trap)', bpm: 88, key: 'Fm', instruments: ['Heavy Bass', 'Distorted Synth', 'Trap Hi-hats', 'Drums'] },
    { label: '💖 Romantic Reggaeton', bpm: 85, key: 'G', instruments: ['Acoustic Guitar', 'Soft Synth', 'Dembow Beat', 'Piano'] },
    { label: '🍑 Perreo (Club Banger)', bpm: 96, key: 'Bm', instruments: ['Aggressive Synth', 'Hard Kick', 'Snare', 'Sub Bass'] },
    { label: '🌴 Tropical Reggaeton', bpm: 92, key: 'D', instruments: ['Steel Drum', 'Marimba', 'Dembow Beat', 'Bass'] },
    { label: '⚡ Moombahton Fusion', bpm: 108, key: 'Cm', instruments: ['Dutch House Synth', 'Reggaeton Beat', 'Vocal Chops'] },
    { label: '🌍 Reggaeton Pop (Global)', bpm: 95, key: 'F', instruments: ['Clean Synth', 'Guitar', 'Pop Drums', 'Bass'] },
    { label: '🔫 Malianteo (Street)', bpm: 90, key: 'C#m', instruments: ['Orchestral Hits', 'Minor Piano', 'Heavy Bass', 'Gunshots FX'] },
    { label: '🚀 Futuristic Reggaeton', bpm: 98, key: 'Am', instruments: ['Arpeggiator', 'Sci-fi FX', 'Metallic Drums', 'Bass'] }
  ],
  'Pop': [
    { label: '✨ Upbeat Dance Pop', bpm: 124, key: 'C', instruments: ['Synthesizer', 'Drums', 'Bass', 'Electric Guitar'] },
    { label: '🎸 Acoustic Pop', bpm: 85, key: 'G', instruments: ['Acoustic Guitar', 'Piano', 'Bass', 'Shaker'] },
    { label: '🌟 K-Pop Style', bpm: 130, key: 'Fm', instruments: ['Synthesizer', 'Bass', 'Drums', 'Vocals'] },
    { label: '🎹 Synth Pop (80s Retro)', bpm: 118, key: 'Am', instruments: ['Vintage Synths', 'Drum Machine', 'Chorus Guitar', 'Bass'] },
    { label: '📼 Indie Pop (Lo-fi)', bpm: 90, key: 'D', instruments: ['Clean Electric Guitar', 'Lo-fi Drums', 'Synth Pad', 'Bass'] },
    { label: '⚡ Power Pop', bpm: 120, key: 'E', instruments: ['Distorted Guitar', 'Rock Drums', 'Bass', 'Synthesizer'] },
    { label: '💃 Latin Pop', bpm: 105, key: 'Dm', instruments: ['Classical Guitar', 'Percussion', 'Trumpet', 'Bass'] },
    { label: '🛏️ Bedroom Pop', bpm: 80, key: 'Fmaj7', instruments: ['Wobbly Synth', 'Drum Machine', 'Muted Guitar', 'Bass'] },
    { label: '⚡ Electro Pop', bpm: 128, key: 'Gm', instruments: ['Heavy Synth', 'Sidechain Bass', 'Electronic Drums'] },
    { label: '🎹 Ballad Pop', bpm: 72, key: 'Bb', instruments: ['Grand Piano', 'Strings', 'Soft Drums', 'Bass'] }
  ],
  'EDM': [
    { label: '🏠 House / Deep House', bpm: 124, key: 'Am', instruments: ['Synthesizer', 'Drum Machine', 'Bass', 'Piano'] },
    { label: '🚀 Trance / Techno', bpm: 138, key: 'Gm', instruments: ['Synthesizer', 'Drum Machine', 'FX', 'Bass'] },
    { label: '🌊 Chill EDM', bpm: 100, key: 'Cm', instruments: ['Synth Pads', 'Soft Piano', 'Deep Bass', 'Drums'] },
    { label: '🔮 Future Bass', bpm: 150, key: 'F', instruments: ['Supersaw Chords', 'Vocal Chops', '808 Bass', 'Trap Drums'] },
    { label: '🔊 Dubstep / Trap', bpm: 140, key: 'Em', instruments: ['Wobble Bass', 'Sub Bass', 'Snare', 'Synth Lead'] },
    { label: '🎹 Progressive House', bpm: 128, key: 'D', instruments: ['Pluck Synth', 'Pad', 'Saw Lead', 'Drums'] },
    { label: '🌴 Tropical House', bpm: 115, key: 'G', instruments: ['Pan Flute', 'Marimba', 'Snap', 'Soft Kick'] },
    { label: '🥁 Drum & Bass', bpm: 174, key: 'Fm', instruments: ['Fast Breakbeat', 'Reese Bass', 'Atmospheric Pad'] },
    { label: '🏟️ Big Room (Festival)', bpm: 128, key: 'F#m', instruments: ['Huge Kick', 'Minimal Drop', 'Reverb Synth'] },
    { label: '🌌 Ambient / Downtempo', bpm: 90, key: 'Am', instruments: ['Drone', 'Field Recordings', 'Soft Piano', 'Sub Bass'] }
  ],
  'Ballad': [
    { label: '🎹 Piano Ballad', bpm: 70, key: 'C', instruments: ['Piano', 'Strings', 'Cello'] },
    { label: '🎸 Power Ballad', bpm: 75, key: 'D', instruments: ['Electric Guitar', 'Drums', 'Bass', 'Synthesizer', 'Piano'] },
    { label: '🍂 Acoustic Love Song', bpm: 80, key: 'E', instruments: ['Acoustic Guitar', 'Strings', 'Bass'] },
    { label: '🎻 Orchestral Ballad', bpm: 68, key: 'G', instruments: ['Full Orchestra', 'Piano', 'Timpani', 'Harp'] },
    { label: '🎤 R&B Ballad', bpm: 65, key: 'Bb', instruments: ['Rhodes Piano', 'Snap', 'Sub Bass', 'Synth Pad'] },
    { label: '🎬 Cinematic Ballad', bpm: 60, key: 'Dm', instruments: ['Piano', 'Epic Strings', 'Taiko Drums', 'Choir'] },
    { label: '🌲 Folk Ballad', bpm: 78, key: 'A', instruments: ['Acoustic Guitar', 'Banjo', 'Fiddle', 'Bass'] },
    { label: '🎷 Soul Ballad', bpm: 70, key: 'F', instruments: ['Organ', 'Clean Guitar', 'Bass', 'Drums', 'Horns'] },
    { label: '🍸 Jazz Ballad', bpm: 60, key: 'Eb', instruments: ['Grand Piano', 'Brush Drums', 'Double Bass', 'Saxophone'] },
    { label: '🏙️ Modern Pop Ballad', bpm: 72, key: 'C', instruments: ['Piano', 'Synthesizer', 'Electronic Drums', 'Strings'] }
  ],
  'Custom': [
    { label: '🥁 Standard Rock/Pop', bpm: 100, key: 'C', instruments: ['Drums', 'Bass', 'Piano', 'Guitar'] },
    { label: '☕ Slow & Chill', bpm: 75, key: 'Am', instruments: ['Piano', 'Synth Pads', 'Bass'] },
    { label: '⚡ Fast & Energetic', bpm: 140, key: 'Em', instruments: ['Synthesizer', 'Drums', 'Bass'] },
    { label: '🎷 Jazz Standard', bpm: 120, key: 'Bb', instruments: ['Piano', 'Double Bass', 'Drums', 'Saxophone'] },
    { label: '🎸 Blues Rock', bpm: 110, key: 'A', instruments: ['Electric Guitar', 'Bass', 'Drums', 'Harmonica'] },
    { label: '📼 Lo-fi Hip Hop', bpm: 80, key: 'F#m', instruments: ['Piano', 'Lo-fi Drums', 'Vinyl Crackle', 'Bass'] },
    { label: '🎻 Classical / Orchestral', bpm: 90, key: 'D', instruments: ['Violins', 'Cellos', 'Brass', 'Woodwinds'] },
    { label: '🕺 Funk / Disco', bpm: 120, key: 'E', instruments: ['Funky Guitar', 'Slap Bass', 'Drums', 'Strings'] },
    { label: '🤠 Country / Folk', bpm: 100, key: 'G', instruments: ['Acoustic Guitar', 'Pedal Steel', 'Bass', 'Drums'] },
    { label: '🧪 Experimental', bpm: 130, key: 'C', instruments: ['Modular Synth', 'Glitch FX', 'Distortion', 'Noise'] }
  ]
};

// --- Helper Components ---
const Icon = ({ name }: { name: string }) => <span className="material-symbols-outlined" style={{ fontSize: '1.2em', verticalAlign: 'bottom' }}>{name}</span>;

const NavButton = ({ active, onClick, icon, label, legibilityMode }: any) => (
  <button 
    onClick={onClick}
    style={{ 
      background: 'none', border: 'none', 
      color: active 
        ? (legibilityMode ? '#FDE047' : '#e11d48') 
        : (legibilityMode ? '#E5E7EB' : '#6b7280'), 
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
      cursor: 'pointer', width: '100%', padding: '10px 0'
    }}
  >
    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>{icon}</span>
    <span style={{ fontSize: '11px', fontWeight: active ? 'bold' : 'normal' }}>{label}</span>
  </button>
);

const ManualModal = ({ onClose }: { onClose: () => void }) => {
  return (
    <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 5000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
        <div style={{
            backgroundColor: '#1f2937', width: '800px', maxWidth: '90vw', maxHeight: '85vh',
            borderRadius: '16px', border: '1px solid #374151', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '20px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#fbbf24' }}>menu_book</span>
                    Suno Studio Pro 사용 매뉴얼
                </h2>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
            <div style={{ padding: '30px', overflowY: 'auto', color: '#e5e7eb', lineHeight: '1.7' }}>
                <section style={{ marginBottom: '30px' }}>
                    <h3 style={{ color: '#e11d48', borderBottom: '1px solid #374151', paddingBottom: '8px', marginBottom: '15px' }}>1. 프로젝트 시작 (Dashboard)</h3>
                    <p>새로운 음악 프로젝트를 생성하고 관리하는 공간입니다.</p>
                    <ul style={{ paddingLeft: '20px', color: '#d1d5db', fontSize: '14px' }}>
                        <li><strong>New Project:</strong> 장르(Salsa, Bachata 등), 무드, 제목을 설정하여 프로젝트를 생성합니다.</li>
                        <li><strong>프로젝트 관리:</strong> 생성된 프로젝트를 클릭하여 편집하거나, JSON 파일로 내보내기/삭제가 가능합니다.</li>
                    </ul>
                </section>

                <section style={{ marginBottom: '30px' }}>
                    <h3 style={{ color: '#fbbf24', borderBottom: '1px solid #374151', paddingBottom: '8px', marginBottom: '15px' }}>2. 기획 (Concept Tab)</h3>
                    <p>곡의 주제와 방향성을 설정합니다.</p>
                    <ul style={{ paddingLeft: '20px', color: '#d1d5db', fontSize: '14px' }}>
                        <li><strong>AI 아이디어 팩:</strong> 장르에 어울리는 제목, 주제, 스타일을 AI가 추천해줍니다.</li>
                        <li><strong>참고할 노래 (Reference):</strong> 유튜브나 기존 곡의 정보를 입력하면, 해당 곡의 바이브를 분석하여 가사와 사운드 생성에 반영합니다.</li>
                    </ul>
                </section>

                <section style={{ marginBottom: '30px' }}>
                    <h3 style={{ color: '#3b82f6', borderBottom: '1px solid #374151', paddingBottom: '8px', marginBottom: '15px' }}>3. 구조 설계 (Structure Tab)</h3>
                    <p>곡의 흐름(Intro, Verse, Chorus 등)을 블록 단위로 설계합니다.</p>
                    <ul style={{ paddingLeft: '20px', color: '#d1d5db', fontSize: '14px' }}>
                        <li><strong>블록 편집:</strong> 각 파트의 설명(Description)을 수정하거나 순서를 변경할 수 있습니다.</li>
                        <li><strong>인트로 스타일:</strong> 곡의 시작 분위기를 결정합니다 (예: 부드러운 기타, 강렬한 드럼 등).</li>
                    </ul>
                </section>

                <section style={{ marginBottom: '30px' }}>
                    <h3 style={{ color: '#10b981', borderBottom: '1px solid #374151', paddingBottom: '8px', marginBottom: '15px' }}>4. 가사 작업 (Lyrics Tab)</h3>
                    <p>AI를 활용해 곡의 구조에 맞는 가사를 생성합니다.</p>
                    <ul style={{ paddingLeft: '20px', color: '#d1d5db', fontSize: '14px' }}>
                        <li><strong>Dance Optimization Mode:</strong> 댄서들이 박자를 세기 쉽도록 8-count 구조에 맞춰 가사를 생성합니다.</li>
                        <li><strong>AI 길이 자동 조절:</strong> 설정된 목표 시간(Duration)에 맞춰 가사의 분량을 자동으로 조절합니다.</li>
                    </ul>
                </section>

                <section style={{ marginBottom: '30px' }}>
                    <h3 style={{ color: '#8b5cf6', borderBottom: '1px solid #374151', paddingBottom: '8px', marginBottom: '15px' }}>5. 사운드 디자인 (Sound Tab)</h3>
                    <p>Suno.ai에서 사용할 프롬프트를 생성합니다.</p>
                    <ul style={{ paddingLeft: '20px', color: '#d1d5db', fontSize: '14px' }}>
                        <li><strong>장르별 프리셋:</strong> 선택한 장르에 최적화된 BPM, Key, 악기 구성을 불러옵니다.</li>
                        <li><strong>Strict Dance Mode:</strong> 춤추기 좋은 정박(Steady Beat)을 유지하도록 프롬프트를 강화합니다.</li>
                        <li><strong>BPM 업로드:</strong> 오디오 파일을 업로드하여 BPM을 분석하고 프로젝트에 적용할 수 있습니다.</li>
                    </ul>
                </section>

                <section style={{ marginBottom: '30px' }}>
                    <h3 style={{ color: '#ec4899', borderBottom: '1px solid #374151', paddingBottom: '8px', marginBottom: '15px' }}>6. 아트 & 배포 (Art & Export)</h3>
                    <ul style={{ paddingLeft: '20px', color: '#d1d5db', fontSize: '14px' }}>
                        <li><strong>Art:</strong> 곡의 분위기에 어울리는 앨범 커버를 생성합니다.</li>
                        <li><strong>Export:</strong> 작업한 프로젝트를 JSON으로 백업하거나, 메타데이터 초안(제목, 가사, 태그 등)을 자동 생성하여 복사할 수 있습니다.</li>
                    </ul>
                </section>
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid #374151', textAlign: 'center' }}>
                <button onClick={onClose} style={{ padding: '10px 30px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    닫기
                </button>
            </div>
        </div>
    </div>
  );
};

// --- TAB: Concept ---
const ConceptTab = ({ project, onUpdate, legibilityMode }: any) => {
  const [loading, setLoading] = useState(false);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [themePacks, setThemePacks] = useState<ThemePack[]>([]);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [referenceSuggestions, setReferenceSuggestions] = useState<ReferenceSuggestion[]>([]);
  const [ideaKeywords, setIdeaKeywords] = useState('');

  const generateThemePacks = async () => {
    setLoadingPacks(true);
    try {
        const keywordContext = ideaKeywords.trim() 
            ? `\n        User Keywords/Themes: "${ideaKeywords}".\n        Please prioritize these keywords in the generated concepts.`
            : '';

        const prompt = `Generate 12 unique and creative "Song Idea Packs" for a ${project.genre} (${project.subGenre}) song with a ${project.mood} mood.${keywordContext}
        Each pack must include:
        1. A catchy English Title (with Korean translation in parentheses).
        2. A Topic: A 1-2 sentence description in Korean of the story or scenario.
        3. A Style: A 1-2 sentence description in Korean of the musical production, era, and vibe.

        Strict Requirements:
        - Return ONLY a JSON array of objects.
        - Each object should have keys: "title", "topic", "style".
        - Do not include markdown code blocks or any other text.
        - Use Korean for "topic" and "style".
        - Titles should be formatted like "Title (제목)".
        `;

        const response: any = await getGenAI().models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            topic: { type: Type.STRING },
                            style: { type: Type.STRING }
                        },
                        required: ['title', 'topic', 'style']
                    }
                }
            }
        });

        const data = JSON.parse(response.text || '[]');
        setThemePacks(data);
    } catch (e) {
        console.error(e);
        alert('아이디어 팩 생성 중 오류가 발생했습니다.');
    }
    setLoadingPacks(false);
  };

  const generateTitleSuggestions = async () => {
      if (!project.concept) {
          alert('제목을 추천받으려면 먼저 [주제]를 입력해주세요.');
          return;
      }
      setLoadingTitles(true);
      try {
          const prompt = `Suggest 5 catchy and creative song titles for a ${project.genre} song.
          Topic/Theme: ${project.concept}
          Mood: ${project.mood}
          Requirements:
          - Return ONLY a JSON array of 5 strings.
          - Each string should be in the format: "English Title (한글 제목)".
          - Do not include any other text or markdown.`;

          const response: any = await getGenAI().models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                  }
              }
          });

          const data = JSON.parse(response.text || '[]');
          setTitleSuggestions(data);
      } catch (e) {
          console.error(e);
          alert('제목 추천 중 오류가 발생했습니다.');
      }
      setLoadingTitles(false);
  };

  const generateReferenceSuggestions = async () => {
      setLoadingReferences(true);
      try {
          const prompt = `Suggest 5 popular and characteristic songs that represent the ${project.genre} (${project.subGenre}) genre with a ${project.mood} mood.
          Return ONLY a JSON array of objects.
          Each object should have keys: "song" and "artist".
          Do not include markdown code blocks.`;

          const response: any = await getGenAI().models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
              config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                      type: Type.ARRAY,
                      items: {
                          type: Type.OBJECT,
                          properties: {
                              song: { type: Type.STRING },
                              artist: { type: Type.STRING }
                          },
                          required: ['song', 'artist']
                      }
                  }
              }
          });

          const data = JSON.parse(response.text || '[]');
          setReferenceSuggestions(data);
      } catch (e) {
          console.error(e);
          alert('참고 곡 추천 중 오류가 발생했습니다.');
      }
      setLoadingReferences(false);
  };

  const applyThemePack = (pack: ThemePack) => {
      // Clean title from parentheses for the main project title if needed
      const englishTitle = pack.title.match(/^([^(]+)/)?.[1]?.trim() || pack.title;
      onUpdate({
          title: englishTitle,
          concept: pack.topic,
          styleDescription: pack.style
      });
  };

  const applySuggestedTitle = (fullTitle: string) => {
      const englishTitle = fullTitle.match(/^([^(]+)/)?.[1]?.trim() || fullTitle;
      onUpdate({ title: englishTitle });
  };

  const applyReference = (song: string, artist: string) => {
      onUpdate({ referenceSongTitle: song, referenceArtist: artist });
  };

  const searchYouTube = () => {
      const query = `${project.referenceSongTitle || ''} ${project.referenceArtist || ''}`.trim() || `${project.genre} ${project.mood} music`;
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
  };

  const primaryTextColor = legibilityMode ? '#FFFFFF' : 'white';
  const labelColor = legibilityMode ? '#F9FAF8' : '#d1d5db';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 10px' }}>
      <h2 style={{ borderBottom: '1px solid #374151', paddingBottom: '15px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: primaryTextColor, fontWeight: legibilityMode ? 'bold' : 'normal', fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>
        <span className="material-symbols-outlined" style={{ color: '#fbbf24' }}>auto_awesome</span>
        🎵 프로젝트 기획 (Concept)
      </h2>

      {/* AI Theme Pack Suggestion Section */}
      <div style={{ marginBottom: '40px', padding: '20px', backgroundColor: '#111827', borderRadius: '12px', border: '1px solid #e11d48' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ flex: '1 1 300px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#e11d48', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
                    <span className="material-symbols-outlined">bolt</span> AI 아이디어 팩 (장르별 추천)
                </h3>
                <p style={{ margin: '5px 0 10px 0', fontSize: '13px', color: legibilityMode ? '#E5E7EB' : '#9ca3af' }}>장르와 무드에 맞는 제목, 주제, 스타일을 한 번에 추천받으세요.</p>
                <input 
                    type="text"
                    value={ideaKeywords}
                    onChange={(e) => setIdeaKeywords(e.target.value)}
                    placeholder="✨ 키워드 입력 (선택사항: 예 - 여름, 이별, 커피, 여행...)"
                    style={{ 
                        width: '100%', padding: '10px', backgroundColor: '#1f2937', 
                        border: '1px solid #4b5563', borderRadius: '6px', 
                        color: 'white', fontSize: '13px', boxSizing: 'border-box'
                    }}
                />
              </div>
              <button 
                onClick={generateThemePacks}
                disabled={loadingPacks}
                style={{ 
                    padding: '10px 20px', backgroundColor: '#e11d48', color: 'white', border: 'none', 
                    borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px',
                    height: 'fit-content'
                }}
              >
                {loadingPacks ? 'AI 추천 생성 중...' : <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>magic_button</span> 추천 팩 생성</>}
              </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: '15px', maxHeight: '400px', overflowY: 'auto', padding: '5px' }}>
              {themePacks.length > 0 ? themePacks.map((pack, i) => (
                  <div 
                    key={i}
                    onClick={() => applyThemePack(pack)}
                    style={{ 
                        padding: '15px', backgroundColor: '#1f2937', borderRadius: '10px', cursor: 'pointer', 
                        border: '1px solid #374151', transition: 'all 0.2s', textAlign: 'left'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#e11d48'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#374151'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#fbbf24', marginBottom: '8px' }}>{pack.title}</div>
                      <div style={{ fontSize: '12px', color: '#d1d5db', marginBottom: '10px', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          <strong>주제:</strong> {pack.topic}
                      </div>
                      <div style={{ fontSize: '11px', color: legibilityMode ? '#E5E7EB' : '#9ca3af', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          <strong>스타일:</strong> {pack.style}
                      </div>
                  </div>
              )) : (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#4b5563' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '10px' }}>lightbulb</span>
                      <p>버튼을 눌러 AI가 추천하는 아이디어 팩을 확인해보세요.</p>
                  </div>
              )}
          </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px, 100%), 1fr))', gap: '30px' }}>
          <div>
            <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', color: labelColor, marginBottom: '10px', fontWeight: 'bold' }}>곡의 주제 및 아이디어 (Topic)</label>
                <textarea 
                value={project.concept || ''}
                onChange={e => onUpdate({ concept: e.target.value })}
                placeholder="예: 해변가 파티에서 만난 첫사랑, 뜨거운 살사 댄스..."
                style={{ width: '100%', height: '120px', padding: '15px', borderRadius: '8px', backgroundColor: '#111827', border: '1px solid #374151', color: 'white', resize: 'none', boxSizing: 'border-box' }}
                />
            </div>

            <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', color: '#e11d48', fontWeight: 'bold', marginBottom: '10px' }}>스타일 (Style) - 사운드 생성 가이드</label>
                <textarea 
                value={project.styleDescription || ''}
                onChange={e => onUpdate({ styleDescription: e.target.value })}
                placeholder="예: 1990년대 스타일의 올드스쿨 느낌, 슬프지만 춤추기 좋은, 여성 보컬의 애절함..."
                style={{ width: '100%', height: '120px', padding: '15px', borderRadius: '8px', backgroundColor: '#111827', border: '1px solid #e11d48', color: 'white', resize: 'none', boxSizing: 'border-box' }}
                />
            </div>
          </div>

          <div>
             <div style={{ marginBottom: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                    <label style={{ color: labelColor, fontWeight: 'bold' }}>현재 제목 (Title)</label>
                    <button 
                        onClick={generateTitleSuggestions}
                        disabled={loadingTitles}
                        style={{ 
                            fontSize: '11px', padding: '4px 10px', backgroundColor: '#3b82f6', color: 'white', 
                            border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' 
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>magic_button</span>
                        {loadingTitles ? '추천 중...' : 'AI 제목 추천 (5가지)'}
                    </button>
                </div>
                <input 
                    type="text" 
                    value={project.title}
                    onChange={e => onUpdate({ title: e.target.value })}
                    style={{ width: '100%', padding: '15px', borderRadius: '8px', backgroundColor: '#111827', border: '1px solid #374151', color: 'white', fontSize: '18px', fontWeight: 'bold', boxSizing: 'border-box' }}
                />
                
                {/* Title Suggestions Chips */}
                {titleSuggestions.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {titleSuggestions.map((st, i) => (
                            <button 
                                key={i}
                                onClick={() => applySuggestedTitle(st)}
                                style={{ 
                                    padding: '6px 12px', backgroundColor: '#1f2937', border: '1px solid #3b82f6', 
                                    color: '#93c5fd', borderRadius: '15px', fontSize: '12px', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1f2937'}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                )}
             </div>

             {/* Reference Song Section */}
             <div style={{ padding: '20px', backgroundColor: '#1f2937', borderRadius: '12px', border: '1px solid #374151' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                    <label style={{ color: '#818cf8', fontWeight: 'bold' }}>참고할 노래 (Reference)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={generateReferenceSuggestions}
                            disabled={loadingReferences}
                            style={{ fontSize: '11px', backgroundColor: '#818cf8', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>auto_awesome</span>
                            {loadingReferences ? '추천 중...' : 'AI 추천'}
                        </button>
                        <button 
                            onClick={searchYouTube}
                            style={{ fontSize: '11px', backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>smart_display</span>
                            YouTube
                        </button>
                    </div>
                </div>

                {/* Reference Suggestions Chips */}
                {referenceSuggestions.length > 0 && (
                    <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {referenceSuggestions.map((ref, idx) => (
                            <div 
                                key={idx}
                                onClick={() => applyReference(ref.song, ref.artist)}
                                style={{ 
                                    fontSize: '11px', padding: '8px 12px', backgroundColor: '#111827', 
                                    border: '1px solid #4b5563', borderRadius: '6px', cursor: 'pointer',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.backgroundColor = 'rgba(129, 140, 248, 0.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#4b5563'; e.currentTarget.style.backgroundColor = '#111827'; }}
                            >
                                <span style={{ color: legibilityMode ? '#FFFFFF' : '#d1d5db' }}><strong>{ref.song}</strong> - {ref.artist}</span>
                                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#818cf8' }}>add_circle</span>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input 
                        type="text" 
                        value={project.referenceSongTitle || ''}
                        onChange={e => onUpdate({ referenceSongTitle: e.target.value })}
                        placeholder="노래 제목 (예: Despacito)"
                        style={{ width: '100%', padding: '12px', backgroundColor: '#111827', border: '1px solid #4b5563', color: 'white', borderRadius: '8px', boxSizing: 'border-box' }}
                    />
                    <input 
                        type="text" 
                        value={project.referenceArtist || ''}
                        onChange={e => onUpdate({ referenceArtist: e.target.value })}
                        placeholder="가수 이름 (예: Luis Fonsi)"
                        style={{ width: '100%', padding: '12px', backgroundColor: '#111827', border: '1px solid #4b5563', color: 'white', borderRadius: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <p style={{ fontSize: '12px', color: legibilityMode ? '#E5E7EB' : '#9ca3af', marginTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', marginTop: '2px' }}>info</span>
                    참고 곡 정보를 입력하면 AI가 비슷한 바이브의 가사와 사운드 프롬프트를 생성해줍니다.
                </p>
             </div>
          </div>
      </div>
    </div>
  );
};

// --- TAB: Structure ---
const StructureTab = ({ project, onUpdate, legibilityMode }: any) => {
  const [selectedTemplate, setSelectedTemplate] = useState('Custom');

  const moveBlock = (index: number, direction: -1 | 1) => {
     const newStructure = [...project.structure];
     if (index + direction < 0 || index + direction >= newStructure.length) return;
     const temp = newStructure[index];
     newStructure[index] = newStructure[index + direction];
     newStructure[index + direction] = temp;
     onUpdate({ structure: newStructure });
  };

  const addBlock = (type: string) => {
     const newBlock = { 
         id: Date.now().toString(), 
         type, 
         description: BLOCK_SAMPLES[type]?.[0] || '...',
         duration: type === 'Intro' || type === 'Outro' ? 4 : 8 
     };
     onUpdate({ structure: [...project.structure, newBlock] });
  };

  const removeBlock = (index: number) => {
      const newStructure = [...project.structure];
      newStructure.splice(index, 1);
      onUpdate({ structure: newStructure });
  };

  const updateBlockDescription = (index: number, desc: string) => {
      const newStructure = project.structure.map((block: SongBlock, i: number) => 
        i === index ? { ...block, description: desc } : block
      );
      onUpdate({ structure: newStructure });
  };

  const applyTemplate = (templateName: string) => {
    setSelectedTemplate(templateName);
    if (templateName === 'Custom') return;

    // @ts-ignore
    const template = STRUCTURE_TEMPLATES[templateName];
    if (template) {
        const newStructure = template.map((block: any, idx: number) => ({
            ...block,
            id: Date.now().toString() + idx
        }));
        onUpdate({ structure: newStructure });
    }
  };

  const titleColor = legibilityMode ? '#FFFFFF' : 'white';

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 10px' }}>
        <h2 style={{ borderBottom: '1px solid #374151', paddingBottom: '15px', marginBottom: '20px', color: titleColor, fontWeight: legibilityMode ? 'bold' : 'normal', fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>🎹 곡 구조 설계 (Structure Editor)</h2>
        
        <div style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <span style={{ color: legibilityMode ? '#FFFFFF' : '#d1d5db', fontSize: '14px' }}>구조 템플릿 불러오기:</span>
            <select 
                value={selectedTemplate} 
                onChange={(e) => applyTemplate(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563' }}
            >
                {Object.keys(STRUCTURE_TEMPLATES).map(t => (
                    <option key={t} value={t}>{t}</option>
                ))}
            </select>
            <span style={{ fontSize: '12px', color: legibilityMode ? '#E5E7EB' : '#9ca3af' }}>* 선택 시 현재 구조가 변경됩니다.</span>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
            {['Intro', 'Verse', 'Chorus', 'Bridge', 'Drop', 'Instrumental', 'Outro'].map(type => (
                <button 
                    key={type} 
                    onClick={() => addBlock(type)}
                    style={{ padding: '8px 16px', backgroundColor: '#374151', border: 'none', borderRadius: '20px', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    + {type}
                </button>
            ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '20px', alignItems: 'flex-start', scrollbarWidth: 'thin' }}>
            {project.structure.map((block: SongBlock, i: number) => (
                <div key={block.id} style={{ 
                    minWidth: '220px', 
                    flex: block.duration,
                    backgroundColor: block.type === 'Chorus' ? '#e11d48' : block.type === 'Verse' ? '#2563eb' : '#4b5563',
                    borderRadius: '8px', padding: '15px', position: 'relative',
                    transition: 'all 0.2s',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 'bold', color: '#FFFFFF' }}>{block.type}</span>
                        <button onClick={() => removeBlock(i)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>×</button>
                    </div>
                    
                    {/* Sample Selection */}
                    <select 
                       value={block.description} 
                       onChange={(e) => updateBlockDescription(i, e.target.value)}
                       style={{ width: '100%', marginBottom: '5px', backgroundColor: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', fontSize: '12px', padding: '4px', borderRadius: '4px' }}
                    >
                        <option value={block.description}>{block.description} (Custom)</option>
                        {BLOCK_SAMPLES[block.type]?.map((sample, idx) => (
                            <option key={idx} value={sample}>{sample}</option>
                        ))}
                    </select>

                    <input 
                        type="text" 
                        value={block.description}
                        onChange={(e) => updateBlockDescription(i, e.target.value)}
                        placeholder="직접 입력..."
                        style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: '12px', padding: '4px', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px', gap: '5px' }}>
                         <button onClick={() => moveBlock(i, -1)} style={{ fontSize: '10px', background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px' }}>◀</button>
                         <button onClick={() => moveBlock(i, 1)} style={{ fontSize: '10px', background: 'rgba(0,0,0,0.3)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px' }}>▶</button>
                    </div>
                </div>
            ))}
        </div>

        {/* Intro Style Selector (Bachata Focus) */}
        <div style={{ marginTop: '30px', borderTop: '1px solid #374151', paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontSize: '18px', color: '#e11d48', margin: 0, fontWeight: legibilityMode ? 'bold' : 'normal' }}>🎧 인트로 스타일 설정 (Intro Vibe)</h3>
                {project.introStyle && (
                    <button 
                        onClick={() => onUpdate({ introStyle: undefined })}
                        style={{ 
                            fontSize: '12px', padding: '6px 12px', backgroundColor: '#374151', 
                            border: '1px solid #4b5563', color: legibilityMode ? '#FFFFFF' : '#d1d5db', borderRadius: '6px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '5px'
                        }}
                        title="선택된 인트로 스타일을 해제합니다"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                        선택 해제 (Clear)
                    </button>
                )}
            </div>
            <p style={{ fontSize: '13px', color: legibilityMode ? '#E5E7EB' : '#9ca3af', marginBottom: '20px' }}>
                원하는 인트로 분위기를 선택하면 <strong>가사(Lyrics)</strong>와 <strong>사운드(Prompt)</strong> 생성에 자동으로 반영됩니다.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: '12px' }}>
                {INTRO_STYLES.map(style => {
                    const isSelected = project.introStyle === style.id;
                    return (
                        <div 
                            key={style.id}
                            onClick={() => onUpdate({ introStyle: style.id })}
                            style={{ 
                                padding: '15px', 
                                backgroundColor: isSelected ? 'rgba(225, 29, 72, 0.15)' : '#1f2937', 
                                border: isSelected ? '1px solid #e11d48' : '1px solid #374151',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                        >
                            {isSelected && <div style={{ position: 'absolute', top: '10px', right: '10px', color: '#e11d48' }}>✔</div>}
                            <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '6px', color: isSelected ? '#fbbf24' : 'white' }}>
                                {style.label}
                            </div>
                            <div style={{ fontSize: '12px', color: legibilityMode ? '#E5E7EB' : '#9ca3af', lineHeight: '1.4' }}>
                                {style.desc}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* TIP Section */}
        <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '20px' }}>
             <div style={{ padding: '20px', backgroundColor: '#111827', borderRadius: '8px', border: '1px solid #374151' }}>
                <h3 style={{ fontSize: '16px', margin: '0 0 10px 0', color: '#fbbf24' }}>💡 구조 설계 팁 (Structure Tips)</h3>
                <ul style={{ fontSize: '13px', color: legibilityMode ? '#FFFFFF' : '#d1d5db', paddingLeft: '20px', lineHeight: '1.6' }}>
                    <li><strong>3분 이상 곡 만들기:</strong> [Intro] - [Verse] - [Chorus] - [Verse] - [Chorus] - [Bridge] - [Chorus] - [Outro] 구조를 추천합니다.</li>
                    <li><strong>빌드업:</strong> Chorus 전에 Bridge를 배치하면 감정을 고조시킬 수 있습니다.</li>
                    <li><strong>댄스 음악 (정박):</strong> 인트로를 'Percussion Intro'나 'Full Band Hit'로 설정하여 처음부터 박자를 명확히 하세요.</li>
                </ul>
             </div>

            <div style={{ padding: '20px', backgroundColor: '#111827', borderRadius: '8px', border: '1px solid #374151' }}>
                <h3 style={{ fontSize: '16px', margin: '0 0 10px 0', color: legibilityMode ? '#FFFFFF' : 'white' }}>🎧 DJ Intro/Outro 설정</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: legibilityMode ? '#FFFFFF' : 'inherit' }}>
                        <input type="checkbox" checked={project.structure[0]?.type === 'Intro' && project.structure[0]?.description.includes('DJ')} 
                               onChange={(e) => {
                                   if (e.target.checked) {
                                       if (project.structure[0].type !== 'Intro') {
                                           const newStructure = [{ id: Date.now().toString(), type: 'Intro', description: 'DJ Friendly Intro (Percussion only)', duration: 4 }, ...project.structure];
                                           onUpdate({ structure: newStructure });
                                       } else {
                                            const newStructure = [...project.structure];
                                            newStructure[0] = { ...newStructure[0], description: 'DJ Friendly Intro (Percussion only)' };
                                            onUpdate({ structure: newStructure });
                                       }
                                   }
                               }}
                        /> 
                        DJ Friendly Intro (Percussion Only)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: legibilityMode ? '#FFFFFF' : 'inherit' }}>
                        <input type="checkbox" checked={project.structure[project.structure.length-1]?.type === 'Outro' && project.structure[project.structure.length-1]?.description.includes('DJ')} 
                                onChange={(e) => {
                                   if (e.target.checked) {
                                       // Logic to ensure outro exists
                                       const last = project.structure[project.structure.length-1];
                                       if (last.type !== 'Outro') {
                                            const newStructure = [...project.structure, { id: Date.now().toString(), type: 'Outro', description: 'DJ Friendly Outro (Beat loop)', duration: 4 }];
                                            onUpdate({ structure: newStructure });
                                       } else {
                                            const newStructure = [...project.structure];
                                            newStructure[newStructure.length-1] = { ...newStructure[newStructure.length-1], description: 'DJ Friendly Outro (Beat loop)' };
                                            onUpdate({ structure: newStructure });
                                       }
                                   }
                               }}
                        /> 
                        DJ Friendly Outro (Mixable Loop)
                    </label>
                    
                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#1f2937', borderRadius: '6px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: legibilityMode ? '#FFFFFF' : '#9ca3af', marginBottom: '5px' }}>DJ Name (가사에 포함)</label>
                        <input 
                            type="text" 
                            value={project.djName || ''}
                            onChange={(e) => onUpdate({ djName: e.target.value })}
                            placeholder="예: DJ Loco (입력시 Outro에 반영)"
                            style={{ width: '100%', padding: '8px', backgroundColor: '#374151', border: 'none', color: 'white', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
                        />
                        <div style={{ marginTop: '8px' }}>
                           <button 
                               onClick={() => onUpdate({ djName: 'DJ Doberman' })}
                               style={{ 
                                   background: 'transparent', border: '1px solid #4b5563', borderRadius: '12px', 
                                   color: legibilityMode ? '#FFFFFF' : '#9ca3af', padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
                                   transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '5px'
                               }}
                               onMouseEnter={(e) => {e.currentTarget.style.borderColor = '#e11d48'; e.currentTarget.style.color = '#e11d48';}}
                               onMouseLeave={(e) => {e.currentTarget.style.borderColor = '#4b5563'; e.currentTarget.style.color = legibilityMode ? '#FFFFFF' : '#9ca3af';}}
                           >
                               <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>smart_toy</span>
                               Apply "DJ Doberman"
                           </button>
                        </div>
                        <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0 0' }}>* 이름을 입력하면 가사 생성 시 Intro 또는 Outro 중 한 곳에만 "DJ [Name]" 멘트가 추가됩니다.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

// --- TAB: Lyrics ---
const LyricsTab = ({ project, onUpdate, legibilityMode }: any) => {
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('Korean & English Mix');
  const [lyricLength, setLyricLength] = useState('Standard (~3:00)');
  const [isDanceMode, setIsDanceMode] = useState(false);
  const [autoAdjustLength, setAutoAdjustLength] = useState(false);
  
  // Use persistent project data for variations instead of local state
  const variations = project.lyricVariations || [];
  const selectedVariationIndex = project.selectedLyricVariationIndex ?? null;

  const [loadingVariations, setLoadingVariations] = useState(false);
  const [focusedCardIndex, setFocusedCardIndex] = useState<number | null>(null);

  const generateLyrics = async () => {
    setLoading(true);
    try {
        const structureText = project.structure.map((s: SongBlock) => `[${s.type}]: ${s.description}`).join('\n');
        
        let introInstruction = '';
        if (project.introStyle) {
            const style = INTRO_STYLES.find(s => s.id === project.introStyle);
            if (style) {
                introInstruction = `
                SPECIAL INTRO INSTRUCTION:
                The user has selected the intro vibe: "${style.label}".
                ${style.desc}
                Please indicate this vibe in the [Intro] section of the lyrics (e.g., [Intro: Clean Lead Guitar Solo] or [Intro: Whisper & Bass]).
                `;
            }
        }

        let danceModeInstruction = '';
        if (isDanceMode) {
            const isSalsa = project.genre === 'Salsa';
            const isBachata = project.genre === 'Bachata';
            
            danceModeInstruction = `
            
            *** STRICT DANCE LYRIC MODE ACTIVATED ***
            OBJECTIVE: Generate lyrics strictly optimized for choreography and dancers (8-count structure).

            1. SYLLABLE COUNT & DISPLAY:
               - You MUST display the syllable count at the end of EVERY line in parentheses. 
                 Format: "Lyric text here (count)"
               - ${isSalsa ? 'SALSA PRESET: Target 6-8 syllables per line. Bright, energetic, staccato.' : 
                  isBachata ? 'BACHATA PRESET: Target 7-9 syllables per line. Smooth, sensual, flowing.' : 
                  'DANCE PRESET: Target consistent 8 syllables per line.'}
               - Maintain consistent syllable counts within each 4-line block.

            2. 8-COUNT STRUCTURE (VISUAL):
               - Group lyrics strictly into 4-line blocks (representing one 8-count phrase).
               - Add an empty line between every 4-line block.
               - This is critical for dancers to count the beat.

            3. CONTENT & RHYTHM:
               - Use [Strict Rhythm] (Jeong-bak).
               - Add [Breath] or pause implied at the end of lines.
               - Avoid complex sentences or rubato.
               - Simple, clear words that hit the beat.
            `;
        }

        const referenceInfo = project.referenceSongTitle
            ? `Reference Vibe/Flow: Make the lyrics and rhythm reminiscent of the song "${project.referenceSongTitle}" by ${project.referenceArtist || 'Unknown Artist'}. Capture its emotional tone and rhythmic delivery.`
            : '';

        const prompt = `
          Write lyrics for a ${project.genre} song titled "${project.title}".
          Mood: ${project.mood}.
          Style Description: ${project.styleDescription || 'Standard style'}.
          BPM: ${project.bpm || 95}
          Language Preference: ${language}.
          Target Duration: ${lyricLength}.
          
          CRITICAL: Follow this Structure strictly in this exact order:
          ${structureText}

          Negative Constraints (DO NOT INCLUDE): ${project.excludedThemes || 'None'}.
          
          ${danceModeInstruction}
          
          ${introInstruction}
          ${referenceInfo}

          Instructions:
          - Reflect the "Style Description" in the choice of words and emotional tone.
          ${autoAdjustLength ? `- Target Duration is ${lyricLength}. STRICTLY Adjust the number of lines and stanza length accordingly to match the duration.` : `- Target Duration is ${lyricLength}.`}
          - Output MUST strictly match the defined structure blocks. Generate lyrics for EVERY block in the list.
          - Output format: Include the structure tags (e.g., [Verse 1]) before the lyrics for each block.
          
          CRITICAL: DANCEABILITY & RHYTHM (Jeong-bak / 정박):
          - The song must have a comfortable, unchanging, steady beat suitable for social dancing.
          - Lyrics must match this steady rhythm perfectly (On-Beat). 
          - avoid complex syncopation, rubato, or wordy poetic lines that disrupt the groove.
          
          ${project.genre === 'Salsa' ? '- Include distinct "Coro" (Chorus) and "Pregon" (Lead vocal improv) sections. "Coro" lines should be simple and repetitive.' : ''}
          ${project.djName ? `- IMPORTANT: Include a shoutout to "${project.djName}" in EITHER the [Intro] OR the [Outro]. Choose ONE location only. Do NOT repeat it.` : ''}
        `;

        const response: any = await getGenAI().models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 2048 } } 
        });
        
        onUpdate({ lyrics: response.text });
    } catch (e) {
        alert('Failed to generate lyrics');
    }
    setLoading(false);
  };

  const generateVariations = async () => {
      setLoadingVariations(true);
      try {
          const structureText = project.structure.map((s: SongBlock) => `[${s.type}]: ${s.description}`).join('\n');
          const prompt = `
            Generate 5 distinct and creative lyric concepts for a ${project.genre} song.
            Topic: ${project.concept || 'Freestyle'}
            Mood: ${project.mood}
            Style: ${project.styleDescription || 'Standard'}
            
            CRITICAL: Follow this Structure strictly in this exact order for all 5 variations:
            ${structureText}
            
            Requirements:
            1. Create 5 different versions (e.g., Emotional, Rhythmic, Story-telling, Minimal, Energetic).
            2. For each version, provide:
               - "title": A catchy title.
               - "rationale": A brief description (in Korean) of the style/vibe.
               - "lyrics": The full lyrics structured with tags like [Verse], [Chorus].
            3. Ensure lyrics are suitable for Suno.ai (musical generation).
            4. CRITICAL: Every version MUST include lyrics for EACH block defined in the structure in the exact order provided. Do not skip blocks or change their order.
            
            Return ONLY a JSON array of 5 objects.
            Schema: [{ title: string, rationale: string, lyrics: string }]
          `;

          const response: any = await getGenAI().models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            rationale: { type: Type.STRING },
                            lyrics: { type: Type.STRING }
                        },
                        required: ['title', 'rationale', 'lyrics']
                    }
                }
            }
        });
        
        const data = JSON.parse(response.text || '[]');
        // Save variations to project
        onUpdate({ lyricVariations: data, selectedLyricVariationIndex: null });
        setFocusedCardIndex(null); // Reset focus
      } catch (e) {
          console.error(e);
          alert('Failed to generate variations.');
      }
      setLoadingVariations(false);
  };

  const copyToClipboard = () => {
    if (!project.lyrics) return;
    navigator.clipboard.writeText(project.lyrics);
    alert('Lyrics Copied!');
  };

  const applyVariation = (v: any, index: number) => {
      if (confirm('이 가사를 에디터에 적용하시겠습니까? (기존 내용은 덮어씌워집니다)')) {
          onUpdate({ lyrics: v.lyrics, selectedLyricVariationIndex: index });
      }
  };

  const titleColor = legibilityMode ? '#FFFFFF' : 'white';
  const labelColor = legibilityMode ? '#F9FAF8' : '#9ca3af';

  return (
    <div className="tab-layout lyrics-tab" style={{ 
        width: '100%', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', 
        gap: '20px', 
        minHeight: '600px',
        padding: '0 10px'
    }}>
      
      {/* Column 1: Settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '10px' }}>
         <h2 style={{ fontSize: '20px', borderBottom: '1px solid #374151', paddingBottom: '15px', margin: 0, display:'flex', alignItems:'center', gap:'10px', color: titleColor, fontWeight: legibilityMode ? 'bold' : 'normal' }}>
            <span className="material-symbols-outlined" style={{ color: '#fbbf24' }}>tune</span> 설정 (Settings)
         </h2>

         {/* Info Box */}
         <div style={{ backgroundColor: '#111827', padding: '15px', borderRadius: '8px', border: '1px solid #374151' }}>
             <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: labelColor }}>현재 스타일</p>
             <p style={{ margin: 0, fontWeight: 'bold', color: '#e11d48', fontSize: '13px', lineHeight: '1.4' }}>
                {project.styleDescription || '설정된 스타일 없음'}
             </p>
             {project.introStyle && (
                    <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#fbbf24' }}>
                        + Intro: {INTRO_STYLES.find(s => s.id === project.introStyle)?.label}
                    </p>
            )}
            {project.referenceSongTitle && (
                <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#818cf8' }}>
                    + Reference: {project.referenceSongTitle} ({project.referenceArtist})
                </p>
            )}
         </div>

         {/* Controls */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
             <div>
                <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '5px' }}>언어 (Language)</label>
                <select 
                    value={language} 
                    onChange={e => setLanguage(e.target.value)}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px' }}
                >
                    <option>Korean & English Mix</option>
                    <option>Korean Only</option>
                    <option>English Only</option>
                    <option>Spanish & English (Latin)</option>
                </select>
            </div>
            <div>
                 <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '5px' }}>길이 (Duration)</label>
                 <select 
                    value={lyricLength} 
                    onChange={e => setLyricLength(e.target.value)}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px' }}
                >
                    <option value="Short (~2:00)">Short (~2:00)</option>
                    <option value="Standard (~3:00)">Standard (~3:00)</option>
                    <option value="Long (~4:00)">Long (~4:00)</option>
                    <option value="Epic (~5:00+)">Epic (~5:00+)</option>
                 </select>
            </div>
            
            {/* Toggles */}
            <div 
                onClick={() => setIsDanceMode(!isDanceMode)}
                style={{ padding: '12px', backgroundColor: '#1f2937', borderRadius: '8px', border: isDanceMode ? '1px solid #10b981' : '1px solid #374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: isDanceMode ? '#10b981' : (legibilityMode ? '#FFFFFF' : '#f9fafb') }}>Dance Mode (8-count)</div>
                <div style={{ width: '36px', height: '20px', backgroundColor: isDanceMode ? '#10b981' : '#4b5563', borderRadius: '10px', position: 'relative' }}>
                    <div style={{ width: '16px', height: '16px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: isDanceMode ? '18px' : '2px', transition: 'left 0.2s' }} />
                </div>
            </div>

            <div 
                onClick={() => setAutoAdjustLength(!autoAdjustLength)}
                style={{ padding: '12px', backgroundColor: '#1f2937', borderRadius: '8px', border: autoAdjustLength ? '1px solid #fbbf24' : '1px solid #374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: autoAdjustLength ? '#fbbf24' : (legibilityMode ? '#FFFFFF' : '#f9fafb') }}>Auto-Length Adjust</div>
                 <div style={{ width: '36px', height: '20px', backgroundColor: autoAdjustLength ? '#fbbf24' : '#4b5563', borderRadius: '10px', position: 'relative' }}>
                    <div style={{ width: '16px', height: '16px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: autoAdjustLength ? '18px' : '2px', transition: 'left 0.2s' }} />
                </div>
            </div>

             <div>
                <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '5px' }}>제외 키워드 (Negative)</label>
                <input 
                    type="text" 
                    value={project.excludedThemes || ''}
                    onChange={e => onUpdate({ excludedThemes: e.target.value })}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#374151', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', boxSizing: 'border-box' }}
                />
            </div>

            <div style={{ marginTop: '10px', paddingTop: '10px', fontSize: '13px', color: labelColor, borderTop: '1px solid #374151' }}>
                <span>BPM: {project.bpm} ({project.bpm >= 105 ? 'Fast' : 'Slow'})</span>
            </div>
         </div>

         <button 
            onClick={generateLyrics}
            disabled={loading}
            style={{ 
                width: '100%', padding: '15px', backgroundColor: loading ? '#4b5563' : '#e11d48', 
                color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer',
                marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
         >
            {loading ? 'Thinking...' : <><span className="material-symbols-outlined">auto_awesome</span> 현재 설정으로 생성</>}
         </button>
      </div>

      {/* Column 2: Variations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', borderLeft: '1px solid #374151', borderRight: '1px solid #374151', padding: '0 20px', overflowY: 'auto' }}>
         <h2 style={{ fontSize: '20px', borderBottom: '1px solid #374151', paddingBottom: '15px', margin: 0, color: '#3b82f6', display:'flex', alignItems:'center', gap:'10px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
             <span className="material-symbols-outlined">lightbulb</span> 아이디어 (5 Variations)
         </h2>
         
         <div style={{ backgroundColor: '#1e3a8a', borderRadius: '8px', padding: '15px' }}>
             <p style={{ fontSize: '12px', color: '#bfdbfe', margin: '0 0 10px 0' }}>
                 주제와 무드에 맞는 5가지 다른 스타일의 가사를 제안받아보세요. (설정한 구조가 반영됩니다)
             </p>
             <button 
                onClick={generateVariations}
                disabled={loadingVariations}
                style={{ 
                    width: '100%', padding: '10px', backgroundColor: '#3b82f6', color: 'white', 
                    border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: loadingVariations ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                }}
             >
                {loadingVariations ? '아이디어 구상 중...' : '✨ 5가지 버전 생성하기'}
             </button>
         </div>

         <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
             {variations.length > 0 ? variations.map((v: any, i: number) => {
                 const isApplied = selectedVariationIndex === i;
                 const isSelected = focusedCardIndex === i;

                 let borderColor = '#4b5563';
                 let bgColor = '#1f2937';
                 let boxShadow = 'none';
                 let transform = 'scale(1)';

                 if (isApplied) {
                    borderColor = '#34d399';
                    bgColor = 'rgba(6, 78, 59, 0.4)';
                    boxShadow = '0 0 20px rgba(16, 185, 129, 0.2)';
                    transform = 'scale(1.02)';
                 }
                 
                 if (isSelected) {
                     borderColor = '#3b82f6';
                     if (!isApplied) {
                        bgColor = 'rgba(59, 130, 246, 0.15)';
                        transform = 'scale(1.02)';
                     }
                 }

                 return (
                     <div key={i} 
                         onClick={() => setFocusedCardIndex(i)}
                         style={{ 
                         backgroundColor: bgColor, 
                         borderRadius: '8px', 
                         border: `2px solid ${borderColor}`,
                         padding: '15px', 
                         display: 'flex', 
                         flexDirection: 'column', 
                         gap: '8px',
                         transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                         boxShadow: boxShadow,
                         transform: transform,
                         cursor: 'pointer'
                     }}>
                         <div style={{ fontWeight: 'bold', color: isApplied ? '#34d399' : (isSelected ? '#60a5fa' : '#fbbf24'), fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{i+1}. {v.title}</span>
                            {isApplied && <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#34d399' }}>check_circle</span>}
                         </div>
                         <div style={{ fontSize: '12px', color: isApplied ? '#d1fae5' : (legibilityMode ? '#E5E7EB' : '#9ca3af'), lineHeight: '1.4' }}>{v.rationale}</div>
                         <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                applyVariation(v, i);
                            }}
                            style={{ 
                                marginTop: '5px', 
                                padding: '10px', 
                                backgroundColor: isApplied ? '#10b981' : '#374151', 
                                border: 'none', 
                                borderRadius: '6px', 
                                color: 'white', 
                                fontSize: '13px', 
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '8px',
                                fontWeight: isApplied ? 'bold' : '500',
                                transition: 'all 0.2s',
                                boxShadow: isApplied ? '0 4px 6px rgba(0,0,0,0.2)' : 'none'
                            }}
                         >
                            {isApplied ? (
                                <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span> 적용됨 (Applied)</>
                            ) : (
                                <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span> 에디터로 적용</>
                            )}
                         </button>
                     </div>
                 );
             }) : (
                 <div style={{ textAlign: 'center', padding: '30px', color: '#4b5563' }}>
                     <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>library_music</span>
                     <p style={{ fontSize: '13px' }}>생성된 아이디어가 없습니다.</p>
                 </div>
             )}
         </div>
      </div>

      {/* Column 3: Editor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', height: '100%', minHeight: '400px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #374151', paddingBottom: '15px', height: '41px' }}>
             <h2 style={{ fontSize: '20px', margin: 0, color: '#e11d48', display:'flex', alignItems:'center', gap:'10px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
                <span className="material-symbols-outlined">edit_note</span> 에디터 (Editor)
             </h2>
             <button
                 onClick={copyToClipboard}
                 disabled={!project.lyrics}
                 style={{
                    padding: '6px 12px', backgroundColor: '#374151',
                    color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer',
                    fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px'
                 }}
            >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>content_copy</span> 복사
            </button>
         </div>
         
         <textarea 
            value={project.lyrics || ''}
            onChange={e => onUpdate({ lyrics: e.target.value })}
            placeholder="AI가 생성한 가사가 이곳에 표시됩니다. 직접 수정할 수도 있습니다."
            style={{ 
                flex: 1, padding: '20px', borderRadius: '8px', backgroundColor: '#111827', 
                border: '1px solid #374151', color: '#e5e7eb', resize: 'none', lineHeight: '1.6', fontFamily: 'monospace',
                fontSize: '14px', width: '100%', boxSizing: 'border-box'
            }}
        />
      </div>
    </div>
  );
};

// --- TAB: Sound ---
const SoundTab = ({ project, onUpdate, legibilityMode }: any) => {
  const [loading, setLoading] = useState(false);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [useStrictDanceMode, setUseStrictDanceMode] = useState(true);
  const [samplePrompts, setSamplePrompts] = useState<SamplePrompt[]>([]);
  const [isAddPromptOpen, setIsAddPromptOpen] = useState(false);
  const [newPromptForm, setNewPromptForm] = useState({ label: '', text: '' });
  const [localPrompt, setLocalPrompt] = useState(project.sunoPrompt || '');
  const [isDetectingBPM, setIsDetectingBPM] = useState(false);
  const [sunoVersion, setSunoVersion] = useState<'v3.5' | 'v5'>('v5');
  const [isDanceGuideOpen, setIsDanceGuideOpen] = useState(false);
  
  // Custom Instrument Preset State
  const [customInstrumentPresets, setCustomInstrumentPresets] = useState<InstrumentPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');

  // Constants specific to SoundTab
  const DANCE_GUIDE = [
    { genre: 'Salsa', bpm: '150 - 220', key: 'Am, Cm, Gm, Dm', desc: '빠르고 에너지가 넘침 (On2 댄서는 180~200 선호)' },
    { genre: 'Bachata', bpm: '108 - 135', key: 'Bm, C#m, Am, Em', desc: '감성적이고 센슈얼한 흐름 (기타 선율 중요)' },
    { genre: 'Kizomba', bpm: '80 - 95', key: 'Cm, Bbm, Gm', desc: '느리고 묵직한 베이스 (Ghetto Zouk 스타일)' },
    { genre: 'Cha Cha', bpm: '110 - 130', key: 'Gm, Dm, Am', desc: '정확한 퍼커션 리듬이 중요' },
    { genre: 'Merengue', bpm: '130 - 170', key: 'C, G, F', desc: '매우 빠르고 신나는 행진곡 리듬' },
    { genre: 'Reggaeton', bpm: '90 - 100', key: 'F#m, Am, Em', desc: '묵직한 뎀보우 리듬' },
    { genre: 'Pop/Disco', bpm: '118 - 128', key: 'C, Am, G', desc: '가장 일반적인 댄스 템포' },
  ];

  useEffect(() => {
      setLocalPrompt(project.sunoPrompt || '');
  }, [project.sunoPrompt]);

  useEffect(() => {
    const savedPrompts = localStorage.getItem('suno_custom_prompts');
    if (savedPrompts) {
        setSamplePrompts(JSON.parse(savedPrompts));
    } else {
        setSamplePrompts(DEFAULT_SAMPLE_PROMPTS);
    }

    const savedInstrumentPresets = localStorage.getItem('suno_instrument_presets');
    if (savedInstrumentPresets) {
        setCustomInstrumentPresets(JSON.parse(savedInstrumentPresets));
    }
  }, []);

  const saveSamplePrompts = (prompts: SamplePrompt[]) => {
      setSamplePrompts(prompts);
      localStorage.setItem('suno_custom_prompts', JSON.stringify(prompts));
  };

  const saveInstrumentPresets = (presets: InstrumentPreset[]) => {
      setCustomInstrumentPresets(presets);
      localStorage.setItem('suno_instrument_presets', JSON.stringify(presets));
  };

  const handleSaveInstrumentPreset = () => {
      if (!newPresetName.trim()) {
          alert('프리셋 이름을 입력하세요.');
          return;
      }
      if (project.instruments.length === 0) {
          alert('최소 하나 이상의 악기를 선택해야 합니다.');
          return;
      }
      const updated = [...customInstrumentPresets, { name: newPresetName.trim(), instruments: [...project.instruments] }];
      saveInstrumentPresets(updated);
      setNewPresetName('');
  };

  const handleDeleteInstrumentPreset = (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      const updated = [...customInstrumentPresets];
      updated.splice(index, 1);
      saveInstrumentPresets(updated);
  };

  const applyInstrumentPreset = (preset: InstrumentPreset) => {
      onUpdate({ instruments: preset.instruments });
  };

  const deleteSamplePrompt = (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      const updated = [...samplePrompts];
      updated.splice(index, 1);
      saveSamplePrompts(updated);
  };

  const handleAddPrompt = () => {
      if (!newPromptForm.label || !newPromptForm.text) {
          alert('Label and Text are required');
          return;
      }
      const updated = [...samplePrompts, newPromptForm];
      saveSamplePrompts(updated);
      setNewPromptForm({ label: '', text: '' });
      setIsAddPromptOpen(false);
  };

  const toggleInstrument = (inst: string) => {
      const newInsts = project.instruments.includes(inst) 
        ? project.instruments.filter((i: string) => i !== inst)
        : [...project.instruments, inst];
      onUpdate({ instruments: newInsts });
  };

  const handleBpmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      if (file.size > 10 * 1024 * 1024) {
          alert('File is too large. Please use a clip under 10MB.');
          return;
      }

      setIsDetectingBPM(true);
      try {
          const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => {
                  const result = reader.result as string;
                  const base64 = result.split(',')[1];
                  resolve(base64);
              };
              reader.onerror = reject;
          });

          const prompt = "Analyze the tempo of this audio clip. Estimate the BPM (Beats Per Minute). Return ONLY the integer number (e.g. 120). Do NOT write any other text.";
          
          const response: any = await getGenAI().models.generateContent({
              model: 'gemini-2.5-flash',
              contents: {
                  parts: [
                      { text: prompt },
                      {
                          inlineData: {
                              mimeType: file.type,
                              data: base64Data
                          }
                      }
                  ]
              }
          });

          const text = response.text?.trim();
          const bpmMatch = text?.match(/\d+/);
          
          if (bpmMatch) {
              const bpm = parseInt(bpmMatch[0]);
              if (bpm > 0 && bpm < 300) {
                   onUpdate({ bpm });
                   alert(`BPM Detected: ${bpm}`);
              } else {
                   alert('Detected value seems invalid. Please try again.');
              }
          } else {
              alert('Could not detect BPM from the audio.');
          }
      } catch (e) {
          console.error(e);
          alert('Failed to analyze audio.');
      } finally {
          setIsDetectingBPM(false);
          e.target.value = '';
      }
  };

  const generatePrompt = async () => {
    setLoading(true);
    try {
        let danceInstruction = '';
        if (useStrictDanceMode) {
             danceInstruction = `
             STRICT DANCE MODE:
             - The beat MUST be constant and steady (Metronomic).
             - Emphasis on the "1" count.
             - Clear percussion suitable for social dancing.
             `;
        }

        let introInstruction = '';
        if (project.introStyle) {
            const style = INTRO_STYLES.find(s => s.id === project.introStyle);
            if (style) {
                introInstruction = `Intro Style: ${style.sunoTags}`;
            }
        }

        const versionContext = sunoVersion === 'v5' 
            ? "Suno v5 (Latest). Focus on high-fidelity, clarity, and modern production standards." 
            : "Suno.ai v3.5 (Standard).";

        const prompt = `
          Construct a high-quality prompt for a music generation AI (${versionContext}).
          
          Project Metadata:
          - Genre: ${project.genre} (${project.subGenre})
          - Mood: ${project.mood}
          - Style: ${project.styleDescription}
          - Instruments: ${(project.instruments || []).join(', ')}
          - Vocal Type: ${project.vocalType}
          - BPM: ${project.bpm}
          - Key: ${project.key}
          
          ${danceInstruction}
          ${introInstruction}

          Requirement:
          - Create a comma-separated list of tags and style descriptors.
          - Include genre, mood, key instruments, vocal type, and production style.
          - Format: "[Tag 1], [Tag 2], [Tag 3], ..."
          - Limit to around 200 characters max.
          - Output ONLY the prompt string.
        `;

        const response: any = await getGenAI().models.generateContent({
             model: 'gemini-3-flash-preview',
             contents: prompt,
        });
        
        onUpdate({ sunoPrompt: response.text });
    } catch (e) {
        alert('Prompt generation failed');
    }
    setLoading(false);
  };

  const generateCompositionAdvice = async () => {
    setLoadingAdvice(true);
    try {
        const prompt = `
          Provide professional AI music composition suggestions for a ${project.genre} (${project.subGenre}) song.
          Mood: ${project.mood}. 
          BPM: ${project.bpm}. 
          Key: ${project.key}. 
          Instruments: ${project.instruments.join(', ')}.

          Requirements:
          - Provide structured advice in Korean.
          - Focus on 3 categories: 
            1. Rhythmic Patterns (리듬 가이드)
            2. Melodic Style (멜로디 제안)
            3. Harmonic Progression (추천 코드 진행)
          - Be specific to the genre.
          - keep it concise and actionable for someone creating music in Suno.ai.
          - Format with Markdown.
        `;

        const response: any = await getGenAI().models.generateContent({
             model: 'gemini-3-flash-preview',
             contents: prompt,
        });
        
        onUpdate({ compositionAdvice: response.text });
    } catch (e) {
        alert('Composition advice generation failed');
    }
    setLoadingAdvice(false);
  };

  const applyPreset = (preset: any) => {
      onUpdate({
          bpm: preset.bpm,
          key: preset.key,
          instruments: preset.instruments || []
      });
  };

  const handleSavePrompt = () => {
      onUpdate({ sunoPrompt: localPrompt });
      const btn = document.getElementById('save-prompt-btn');
      if (btn) {
          const originalText = btn.innerText;
          btn.innerText = 'Saved!';
          setTimeout(() => { btn.innerText = originalText; }, 1500);
      }
  };

  const copyToClipboard = () => {
      navigator.clipboard.writeText(localPrompt);
      alert('Prompt Copied!');
  };

  const titleColor = legibilityMode ? '#FFFFFF' : '#fbbf24';
  const labelColor = legibilityMode ? '#F9FAF8' : '#9ca3af';

  return (
      <div className="tab-layout sound-tab" style={{ 
          width: '100%', 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', 
          gap: '20px', 
          minHeight: '600px',
          padding: '0 10px'
      }}>
          
          {/* Column 1: Configuration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '10px' }}>
              <h2 style={{ fontSize: '18px', borderBottom: '1px solid #374151', paddingBottom: '15px', margin: 0, color: titleColor, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
                  <span className="material-symbols-outlined">settings</span> 설정 (Config)
              </h2>

              {/* Presets */}
              <div style={{ backgroundColor: '#1f2937', padding: '15px', borderRadius: '8px', border: '1px solid #374151' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: labelColor }}>장르 프리셋 (Presets)</label>
                  <select 
                      onChange={(e) => {
                          const preset = GENRE_PRESETS[project.genre]?.find(p => p.label === e.target.value);
                          if (preset) applyPreset(preset);
                      }}
                      style={{ width: '100%', padding: '10px', backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '6px' }}
                  >
                      <option value="">-- 프리셋 선택 --</option>
                      {GENRE_PRESETS[project.genre]?.map((p, i) => (
                          <option key={i} value={p.label}>{p.label}</option>
                      ))}
                  </select>
              </div>

              {/* BPM & Key */}
              <div style={{ backgroundColor: '#1f2937', padding: '15px', borderRadius: '8px', border: '1px solid #374151' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
                      {/* BPM Section */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: labelColor, fontWeight: '500' }}>BPM</label>
                          <div style={{ display: 'flex', gap: '8px', height: '42px' }}>
                             <input 
                                type="number" 
                                value={project.bpm || ''} 
                                onChange={e => {
                                  const val = parseInt(e.target.value);
                                  onUpdate({ bpm: isNaN(val) ? 0 : val });
                                }}
                                style={{ 
                                    flex: 1, padding: '0 12px', backgroundColor: '#111827', 
                                    border: '1px solid #4b5563', color: 'white', borderRadius: '6px', 
                                    minWidth: '0', height: '100%', fontSize: '14px', boxSizing: 'border-box'
                                }} 
                             />
                             <input 
                                type="file" 
                                id="bpm-upload"
                                accept="audio/*" 
                                style={{ display: 'none' }}
                                onChange={handleBpmUpload}
                             />
                             <label 
                                htmlFor="bpm-upload"
                                title="Upload audio to detect BPM"
                                style={{ 
                                    width: '42px', backgroundColor: '#374151', color: '#e5e7eb', borderRadius: '6px', 
                                    cursor: isDetectingBPM ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent:'center',
                                    flexShrink: 0, height: '100%', border: '1px solid #4b5563', boxSizing: 'border-box',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#4b5563'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#374151'}
                             >
                                {isDetectingBPM ? '⏳' : <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>graphic_eq</span>}
                             </label>
                         </div>
                      </div>
                      
                      {/* Key Section */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: labelColor, fontWeight: '500' }}>Key (조성)</label>
                          <select 
                              value={project.key || ''} 
                              onChange={e => onUpdate({ key: e.target.value })}
                              style={{ 
                                  width: '100%', padding: '0 12px', backgroundColor: '#111827', 
                                  border: '1px solid #4b5563', color: 'white', borderRadius: '6px',
                                  height: '42px', fontSize: '14px', boxSizing: 'border-box', cursor: 'pointer'
                              }}
                          >
                               {['C', 'Cm', 'C#', 'C#m', 'D', 'Dm', 'Eb', 'Ebm', 'E', 'Em', 'F', 'Fm', 'F#', 'F#m', 'G', 'Gm', 'Ab', 'Abm', 'A', 'Am', 'Bb', 'Bbm', 'B', 'Bm'].map(k => (
                                   <option key={k} value={k}>{k}</option>
                               ))}
                          </select>
                      </div>
                  </div>

                  <button 
                    onClick={() => setIsDanceGuideOpen(true)}
                    style={{ 
                        width: '100%', marginBottom: '15px', padding: '8px', 
                        backgroundColor: '#374151', color: '#fbbf24', border: '1px dashed #4b5563', 
                        borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>menu_book</span>
                    최적 BPM & Key 가이드
                  </button>

                  <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: labelColor }}>보컬 타입 (Vocal Type)</label>
                      <select 
                          value={project.vocalType || ''} 
                          onChange={e => onUpdate({ vocalType: e.target.value })}
                          style={{ width: '100%', padding: '10px', backgroundColor: '#111827', border: '1px solid #4b5563', color: 'white', borderRadius: '4px' }}
                      >
                          <option value="Male">Male (남성)</option>
                          <option value="Female">Female (여성)</option>
                          <option value="Duet">Duet (듀엣)</option>
                          <option value="Choir">Choir (합창)</option>
                          <option value="Instrumental">Instrumental (연주곡)</option>
                      </select>
                  </div>
              </div>
          </div>

          {/* Column 2: Instruments & Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '10px' }}>
              <h2 style={{ fontSize: '18px', borderBottom: '1px solid #374151', paddingBottom: '15px', margin: 0, color: '#e11d48', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
                  <span className="material-symbols-outlined">piano</span> 악기 (Instruments)
              </h2>

               {/* Dance Mode Toggle */}
               <div 
                    onClick={() => setUseStrictDanceMode(!useStrictDanceMode)}
                    style={{ 
                        padding: '15px', backgroundColor: '#1f2937', borderRadius: '8px', 
                        border: useStrictDanceMode ? '1px solid #10b981' : '1px solid #374151', 
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="material-symbols-outlined" style={{ color: useStrictDanceMode ? '#10b981' : '#6b7280' }}>music_note</span>
                        <div>
                            <span style={{ display: 'block', fontWeight: 'bold', color: useStrictDanceMode ? '#10b981' : (legibilityMode ? '#FFFFFF' : '#f3f4f6'), fontSize: '13px' }}>Strict Dance Mode</span>
                            <span style={{ fontSize: '10px', color: labelColor }}>Steady beat & rhythm</span>
                        </div>
                    </div>
                     <div style={{ width: '36px', height: '20px', backgroundColor: useStrictDanceMode ? '#10b981' : '#4b5563', borderRadius: '10px', position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: '16px', height: '16px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: useStrictDanceMode ? '18px' : '2px', transition: 'left 0.2s' }} />
                    </div>
                </div>

              {/* Instrument Selection */}
              <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {INSTRUMENTS.map(inst => (
                          <button
                              key={inst}
                              onClick={() => toggleInstrument(inst)}
                              style={{
                                  padding: '6px 10px', fontSize: '11px', borderRadius: '15px', border: '1px solid',
                                  backgroundColor: project.instruments?.includes(inst) ? 'rgba(225, 29, 72, 0.2)' : '#1f2937',
                                  borderColor: project.instruments?.includes(inst) ? '#e11d48' : '#374151',
                                  color: project.instruments?.includes(inst) ? '#e11d48' : (legibilityMode ? '#E5E7EB' : '#9ca3af'),
                                  cursor: 'pointer', flexGrow: 1, textAlign: 'center'
                              }}
                          >
                              {inst}
                          </button>
                      ))}
                  </div>
              </div>

              {/* Custom Instrument Presets */}
              <div style={{ marginTop: 'auto', borderTop: '1px solid #374151', paddingTop: '20px' }}>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '8px' }}>나의 악기 프리셋 (My Presets)</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <input 
                            type="text" 
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            placeholder="프리셋 이름..."
                            style={{ flex: 1, padding: '8px', backgroundColor: '#111827', border: '1px solid #4b5563', color: 'white', borderRadius: '6px', fontSize: '12px', minWidth: 0 }}
                        />
                        <button 
                            onClick={handleSaveInstrumentPreset}
                            style={{ padding: '0 12px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}
                        >
                            Save
                        </button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                      {customInstrumentPresets.length > 0 ? customInstrumentPresets.map((p, idx) => (
                          <div 
                            key={idx}
                            style={{ position: 'relative', display: 'inline-flex' }}
                          >
                              <button 
                                onClick={() => applyInstrumentPreset(p)}
                                style={{ 
                                    padding: '6px 28px 6px 12px', 
                                    backgroundColor: '#374151', 
                                    border: '1px solid #4b5563',
                                    borderRadius: '15px',
                                    color: '#FFFFFF',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                                title={p.instruments.join(', ')}
                              >
                                {p.name}
                              </button>
                              <span 
                                onClick={(e) => handleDeleteInstrumentPreset(e, idx)}
                                style={{ 
                                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                    fontSize: '14px', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold'
                                }}
                              >
                                &times;
                              </span>
                          </div>
                      )) : (
                          <span style={{ fontSize: '11px', color: '#6b7280' }}>저장된 프리셋이 없습니다.</span>
                      )}
                  </div>
              </div>
          </div>

          {/* Column 3: Output */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '18px', borderBottom: '1px solid #374151', paddingBottom: '15px', margin: 0, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
                  <span className="material-symbols-outlined">auto_awesome</span> 생성 (Prompt)
              </h2>

              {/* Version Selector */}
              <div style={{ display: 'flex', backgroundColor: '#111827', padding: '4px', borderRadius: '8px', gap: '4px', border: '1px solid #374151' }}>
                  <button 
                    onClick={() => setSunoVersion('v3.5')}
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', backgroundColor: sunoVersion === 'v3.5' ? '#374151' : 'transparent', color: sunoVersion === 'v3.5' ? 'white' : '#6b7280', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    Suno v3.5
                  </button>
                  <button 
                    onClick={() => setSunoVersion('v5')}
                    style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', backgroundColor: sunoVersion === 'v5' ? '#e11d48' : 'transparent', color: sunoVersion === 'v5' ? 'white' : '#6b7280', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    Suno v5 (Pro)
                  </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                      onClick={generatePrompt}
                      disabled={loading}
                      style={{ flex: '1 1 140px', padding: '15px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                      {loading ? 'Generating...' : <><span className="material-symbols-outlined">auto_fix_high</span> 프롬프트 생성</>}
                  </button>
                  <button 
                      onClick={generateCompositionAdvice}
                      disabled={loadingAdvice}
                      style={{ flex: '1 1 140px', padding: '15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                      {loadingAdvice ? 'Guiding...' : <><span className="material-symbols-outlined">music_note</span> AI 작곡 가이드</>}
                  </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <textarea 
                      value={localPrompt}
                      onChange={e => setLocalPrompt(e.target.value)}
                      placeholder="Suno.ai 프롬프트가 여기에 생성됩니다."
                      style={{ width: '100%', padding: '15px', borderRadius: '8px', backgroundColor: '#111827', border: '1px solid #374151', color: '#fbbf24', resize: 'none', fontFamily: 'monospace', minHeight: '120px', boxSizing: 'border-box' }}
                  />
                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                       <span style={{ fontSize: '11px', color: '#6b7280' }}>
                          {localPrompt.length} chars
                       </span>
                       <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                              id="save-prompt-btn"
                              onClick={handleSavePrompt}
                              style={{ padding: '6px 12px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                          >
                              Save
                          </button>
                          <button 
                              onClick={copyToClipboard}
                              style={{ padding: '6px 12px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                          >
                              Copy
                          </button>
                      </div>
                  </div>
                </div>

                {/* AI Composition Advice Display */}
                {project.compositionAdvice && (
                    <div style={{ backgroundColor: '#111827', border: '1px solid #3b82f6', borderRadius: '12px', padding: '20px', marginTop: '10px' }}>
                        <h3 style={{ margin: '0 0 15px 0', color: '#3b82f6', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="material-symbols-outlined">lightbulb</span> AI 작곡 제안 (Composition Advice)
                        </h3>
                        <div style={{ 
                            fontSize: '13px', color: '#e5e7eb', lineHeight: '1.6', 
                            maxHeight: '400px', overflowY: 'auto', paddingRight: '10px',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {project.compositionAdvice}
                        </div>
                    </div>
                )}
              </div>
              
              <div style={{ marginTop: 'auto', borderTop: '1px solid #374151', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <p style={{ fontSize: '13px', color: labelColor, margin: 0 }}>📌 Quick Sample Prompts</p>
                    <button 
                        onClick={() => setIsAddPromptOpen(true)}
                        style={{ 
                            background: 'transparent', border: '1px solid #4b5563', color: labelColor,
                            borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer'
                        }}
                    >
                        + Add Custom
                    </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                    {samplePrompts.map((sample, idx) => (
                        <div 
                            key={idx}
                            style={{ position: 'relative', display: 'inline-flex' }}
                        >
                            <button 
                                onClick={() => onUpdate({ sunoPrompt: sample.text })}
                                style={{ 
                                    padding: '6px 24px 6px 10px', 
                                    backgroundColor: '#1f2937', 
                                    border: '1px solid #374151',
                                    borderRadius: '15px',
                                    color: legibilityMode ? '#FFFFFF' : '#d1d5db',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '180px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#374151';
                                    e.currentTarget.style.borderColor = '#6b7280';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#1f2937';
                                    e.currentTarget.style.borderColor = '#374151';
                                }}
                                title={sample.text}
                            >
                                {sample.label}
                            </button>
                            <span 
                                onClick={(e) => deleteSamplePrompt(e, idx)}
                                style={{ 
                                    position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                                    fontSize: '12px', color: '#ef4444', cursor: 'pointer',
                                    opacity: 0.6
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                            >
                                &times;
                            </span>
                        </div>
                    ))}
                </div>
            </div>
          </div>
          
          {isAddPromptOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' }}>
                <div style={{ backgroundColor: '#1f2937', padding: '24px', borderRadius: '16px', border: '1px solid #374151', width: 'min(400px, 90vw)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'white' }}>Add Custom Prompt</h3>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '4px' }}>Label (Name)</label>
                        <input 
                            autoFocus
                            type="text" 
                            placeholder="e.g. My Favorite Jazz"
                            value={newPromptForm.label}
                            onChange={(e) => setNewPromptForm({...newPromptForm, label: e.target.value})}
                            style={{ width: '100%', padding: '10px', backgroundColor: '#374151', border: '1px solid #4b5563', color: 'white', borderRadius: '6px', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '4px' }}>Prompt Text</label>
                        <textarea 
                            placeholder="Paste your prompt here..."
                            value={newPromptForm.text}
                            onChange={(e) => setNewPromptForm({...newPromptForm, text: e.target.value})}
                            style={{ width: '100%', height: '100px', padding: '10px', backgroundColor: '#374151', border: '1px solid #4b5563', color: 'white', borderRadius: '6px', resize: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button 
                            onClick={() => setIsAddPromptOpen(false)}
                            style={{ padding: '8px 16px', backgroundColor: 'transparent', color: labelColor, border: 'none', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleAddPrompt}
                            style={{ padding: '8px 16px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Save Prompt
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Dance Guide Modal */}
        {isDanceGuideOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' }}>
                <div style={{ backgroundColor: '#1f2937', padding: '24px', borderRadius: '16px', border: '1px solid #374151', width: 'min(600px, 95vw)', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #374151', paddingBottom: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="material-symbols-outlined" style={{ color: '#fbbf24' }}>accessibility_new</span>
                            최적 BPM & Key 가이드
                        </h3>
                        <button onClick={() => setIsDanceGuideOpen(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    
                    <div style={{ color: '#d1d5db' }}>
                        <p style={{ fontSize: '13px', color: labelColor, marginBottom: '15px' }}>
                            댄서들이 선호하는 장르별 추천 설정값입니다.
                        </p>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '400px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #4b5563', color: '#e11d48' }}>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>장르 (Genre)</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>BPM Range</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>추천 Key</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {DANCE_GUIDE.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #374151' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold', color: legibilityMode ? '#FFFFFF' : 'inherit' }}>{item.genre}</td>
                                            <td style={{ padding: '10px', color: '#fbbf24' }}>{item.bpm}</td>
                                            <td style={{ padding: '10px', color: legibilityMode ? '#E5E7EB' : 'inherit' }}>{item.key}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#374151', borderRadius: '8px', fontSize: '12px', lineHeight: '1.6', color: legibilityMode ? '#FFFFFF' : 'inherit' }}>
                            <strong>💡 팁 (Tip):</strong><br/>
                            - <strong>Salsa:</strong> 180~200 BPM이 대중적입니다.<br/>
                            - <strong>Bachata:</strong> 120 내외가 로맨틱한 분위기에 적당합니다.<br/>
                            - <strong>Key:</strong> 마이너 키(Minor)가 긴장감을 잘 살려줍니다.
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                        <button 
                            onClick={() => setIsDanceGuideOpen(false)}
                            style={{ padding: '8px 24px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
  );
};

// --- TAB: Art ---
const ArtTab = ({ project, onUpdate, legibilityMode }: any) => {
    const [loading, setLoading] = useState(false);
    const [size, setSize] = useState<'1K'|'2K'|'4K'>('1K');
    const [modelType, setModelType] = useState<'flash' | 'pro'>('flash');
    const [selectedSizePreset, setSelectedSizePreset] = useState(0);
    
    // 1. 노래 정보
    const [artTitle, setArtTitle] = useState(project.title || '');
    const [artistName, setArtistName] = useState(project.djName || '');
    const [artistSamples, setArtistSamples] = useState<string[]>([]);

    // 2. 비주얼 컨셉
    const [visualMood, setVisualMood] = useState(project.mood || 'Atmospheric');
    const [visualStyle, setVisualStyle] = useState('Digital Art');
    const [characters, setCharacters] = useState('');
    const [artDescription, setArtDescription] = useState('');

    // 3. 텍스트 디자인 (고급)
    const [fontType, setFontType] = useState(FONT_OPTIONS[0].value);
    const [textEffect, setTextEffect] = useState(TEXT_EFFECT_OPTIONS[0].id);
    const [textColor, setTextColor] = useState('#ffffff');
    const [textOverlay, setTextOverlay] = useState({ x: 50, y: 90, size: 40, opacity: 100 });

    // Generation Mode
    const [generationMode, setGenerationMode] = useState<'AI' | 'PROMPT_ONLY' | 'MOCK'>('AI');
    const [generatedPrompt, setGeneratedPrompt] = useState('');

    // Init Sample Artists
    useEffect(() => {
        const saved = localStorage.getItem('suno_art_artists');
        setArtistSamples(saved ? JSON.parse(saved) : DEFAULT_ARTISTS);
    }, []);

    const saveArtists = (list: string[]) => {
        setArtistSamples(list);
        localStorage.setItem('suno_art_artists', JSON.stringify(list));
    };

    const addArtistSample = () => {
        if (artistName && !artistSamples.includes(artistName)) {
            saveArtists([...artistSamples, artistName]);
        }
    };

    const removeArtistSample = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        saveArtists(artistSamples.filter(a => a !== name));
    };

    // Sync title initially if empty, but allow divergence
    useEffect(() => {
        if (!artTitle && project.title) setArtTitle(project.title);
    }, [project.title]);

    const handleDownload = () => {
        if (project.coverImage) {
            const link = document.createElement('a');
            link.href = project.coverImage;
            link.download = `${project.title.replace(/\s+/g, '_') || 'cover_art'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const generateCoverArt = async () => {
        setLoading(true);
        setGeneratedPrompt('');

        const sizePreset = IMAGE_SIZE_PRESETS[selectedSizePreset];
        let promptAddon = '';
        if (sizePreset.id === 5) promptAddon = 'Composition framed for 4:5 aspect ratio.';
        if (sizePreset.id === 6) promptAddon = 'Wide composition suitable for 1.91:1 link preview.';
        if (sizePreset.id === 7) promptAddon = 'Cinematic 21:9 aspect ratio composition.';
        if (sizePreset.id === 8) promptAddon = 'Tall 1:2 aspect ratio vertical composition.';
        if (sizePreset.id === 9) promptAddon = 'Circular vignette composition centered.';

        const prompt = `
        Album cover art for a song.
        
        [Song Info]
        Genre: ${project.genre}
        
        [Visual Concept]
        Mood: ${visualMood}
        Style: ${visualStyle}
        Subject/Characters: ${characters}
        Detailed Description: ${artDescription || 'A creative and atmospheric composition representing the music.'}
        
        Instructions:
        - High quality, creative composition.
        - Target Ratio: ${sizePreset.label} (${sizePreset.ratio})
        ${promptAddon}
        - Do NOT add text if possible, as it will be added as an overlay.
        `.trim();

        try {
            if (generationMode === 'AI') {
                const modelName = modelType === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
                const imageConfig: any = { aspectRatio: getApiAspectRatio(sizePreset.ratio) };
                if (modelType === 'pro') {
                    imageConfig.imageSize = size;
                }

                const response: any = await getGenAI().models.generateContent({
                    model: modelName,
                    contents: {
                       parts: [{ text: prompt }]
                    },
                    config: {
                        imageConfig: imageConfig
                    }
                });

                let imageUrl = '';
                if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            const base64EncodeString = part.inlineData.data;
                            imageUrl = `data:image/png;base64,${base64EncodeString}`;
                            break;
                        }
                    }
                }
                
                if (imageUrl) {
                    onUpdate({ coverImage: imageUrl });
                } else {
                    alert('No image generated.');
                }

            } else if (generationMode === 'PROMPT_ONLY') {
                setGeneratedPrompt(prompt);
            } else if (generationMode === 'MOCK') {
                // Mock Generation using Canvas
                const canvas = document.createElement('canvas');
                let width = 1024;
                let height = 1024;
                if (sizePreset.ratio === '16:9') { height = 576; }
                else if (sizePreset.ratio === '9:16') { width = 576; }
                else if (sizePreset.ratio === '4:3') { height = 768; }
                else if (sizePreset.ratio === '3:4') { width = 768; }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const gradient = ctx.createLinearGradient(0, 0, width, height);
                    gradient.addColorStop(0, '#1f2937');
                    gradient.addColorStop(1, '#111827');
                    if (visualMood.includes('Happy') || visualMood.includes('Party')) {
                        gradient.addColorStop(0.5, '#f59e0b');
                    } else if (visualMood.includes('Romantic') || visualMood.includes('Sexy')) {
                        gradient.addColorStop(0.5, '#e11d48');
                    } else if (visualMood.includes('Sad') || visualMood.includes('Chill')) {
                        gradient.addColorStop(0.5, '#3b82f6');
                    }
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, width, height);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                    ctx.beginPath();
                    ctx.arc(width/2, height/2, width/3, 0, 2 * Math.PI);
                    ctx.fill();
                    onUpdate({ coverImage: canvas.toDataURL() });
                }
            }
        } catch (e) {
            console.error(e);
            alert('Image generation failed.');
        }
        setLoading(false);
    };

    const currentRatioConfig = IMAGE_SIZE_PRESETS[selectedSizePreset];
    const previewAspectRatio = currentRatioConfig.ratio.replace(':', '/');
    const currentEffectStyle = TEXT_EFFECT_OPTIONS.find(e => e.id === textEffect)?.style || {};
    const titleColor = legibilityMode ? '#FFFFFF' : '#fbbf24';
    const labelColor = legibilityMode ? '#F9FAF8' : '#9ca3af';

    return (
        <div className="tab-layout art-tab" style={{ 
            width: '100%', 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', 
            gap: '20px', 
            minHeight: '600px',
            padding: '0 10px'
        }}>
            
            {/* Column 1: Concept */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '10px' }}>
                 <h2 style={{ fontSize: '18px', borderBottom: '1px solid #374151', paddingBottom: '15px', margin: 0, color: titleColor, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
                    <span className="material-symbols-outlined">palette</span> 컨셉 (Concept)
                 </h2>
                
                <div style={{ backgroundColor: '#1f2937', padding: '15px', borderRadius: '8px', border: '1px solid #374151' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: legibilityMode ? '#FFFFFF' : '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
                        1. 노래 정보 (Song Info)
                    </h3>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '5px' }}>앨범 제목 (Title)</label>
                        <input 
                            type="text" 
                            value={artTitle} 
                            onChange={(e) => setArtTitle(e.target.value)}
                            placeholder="Title"
                            style={{ width: '100%', padding: '10px', backgroundColor: '#111827', border: '1px solid #4b5563', color: 'white', borderRadius: '6px', boxSizing: 'border-box' }} 
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '5px' }}>아티스트 (Artist)</label>
                        <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                            <input 
                                type="text" 
                                value={artistName} 
                                onChange={(e) => setArtistName(e.target.value)}
                                placeholder="Artist Name"
                                style={{ flex: 1, padding: '10px', backgroundColor: '#111827', border: '1px solid #4b5563', color: 'white', borderRadius: '6px', minWidth: 0 }} 
                            />
                            <button onClick={addArtistSample} style={{ padding: '0 12px', backgroundColor: '#374151', border: '1px solid #4b5563', color: '#10b981', borderRadius: '6px', cursor: 'pointer' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {artistSamples.map((a, i) => (
                                <div key={i} onClick={() => setArtistName(a)} 
                                    style={{ 
                                        fontSize: '11px', padding: '4px 8px', borderRadius: '12px', 
                                        backgroundColor: '#111827', border: '1px solid #4b5563', color: legibilityMode ? '#FFFFFF' : '#d1d5db', 
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                >
                                    {a}
                                    <span onClick={(e) => removeArtistSample(a, e)} style={{ fontSize: '14px', color: '#ef4444', fontWeight: 'bold' }}>×</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#1f2937', padding: '15px', borderRadius: '8px', border: '1px solid #374151' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: legibilityMode ? '#FFFFFF' : '#e11d48', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
                        2. 비주얼 컨셉 (Visual Concept)
                    </h3>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '5px' }}>스타일 (Style)</label>
                        <select value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '6px' }}>
                            {ART_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '5px' }}>등장인물 (Characters)</label>
                        <select onChange={(e) => setCharacters(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '6px', marginBottom: '8px' }}>
                            <option value="">-- 샘플 선택 --</option>
                            {CHARACTER_SAMPLES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input 
                            type="text" 
                            value={characters} 
                            onChange={(e) => setCharacters(e.target.value)}
                            placeholder="직접 입력..."
                            style={{ width: '100%', padding: '10px', backgroundColor: '#111827', border: '1px solid #4b5563', color: 'white', borderRadius: '6px', boxSizing: 'border-box' }} 
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '5px' }}>상세 설명 (Description)</label>
                        <textarea 
                            value={artDescription}
                            onChange={(e) => setArtDescription(e.target.value)}
                            placeholder="구체적인 장면 묘사..."
                            style={{ width: '100%', height: '60px', padding: '10px', backgroundColor: '#111827', border: '1px solid #4b5563', color: 'white', borderRadius: '6px', resize: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>
            </div>

            {/* Column 2: Design */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '10px' }}>
                <h2 style={{ fontSize: '18px', borderBottom: '1px solid #374151', paddingBottom: '15px', margin: 0, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
                    <span className="material-symbols-outlined">brush</span> 디자인 (Design)
                 </h2>

                <div style={{ backgroundColor: '#1f2937', padding: '15px', borderRadius: '8px', border: '1px solid #374151' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: legibilityMode ? '#FFFFFF' : '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
                        3. 텍스트 디자인 (Overlay)
                    </h3>
                    <p style={{ fontSize: '11px', color: labelColor, marginTop: '-10px', marginBottom: '15px' }}>* 이미지 생성 후 적용되는 텍스트입니다.</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '15px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '5px' }}>폰트 (Font)</label>
                            <select value={fontType} onChange={(e) => setFontType(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '6px', fontSize: '12px' }}>
                                {FONT_OPTIONS.map((font, idx) => (
                                    <option key={idx} value={font.value} style={{ fontFamily: font.value }}>{font.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                             <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '5px' }}>텍스트 효과 (Effect)</label>
                             <select value={textEffect} onChange={(e) => setTextEffect(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '6px', fontSize: '12px' }}>
                                {TEXT_EFFECT_OPTIONS.map((effect, idx) => (
                                    <option key={idx} value={effect.id}>{effect.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '5px' }}>기본 색상 (Color)</label>
                            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={{ width: '100%', height: '34px', padding: '0', border: 'none', cursor: 'pointer', borderRadius: '4px' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: labelColor, marginBottom: '4px' }}>
                                <span>가로 위치 (X Position)</span> <span>{textOverlay.x}%</span>
                            </label>
                            <input type="range" min="0" max="100" value={textOverlay.x} onChange={e => setTextOverlay({...textOverlay, x: parseInt(e.target.value)})} style={{ width: '100%', cursor: 'pointer' }} />
                        </div>
                        <div>
                            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: labelColor, marginBottom: '4px' }}>
                                <span>세로 위치 (Y Position)</span> <span>{textOverlay.y}%</span>
                            </label>
                            <input type="range" min="0" max="100" value={textOverlay.y} onChange={e => setTextOverlay({...textOverlay, y: parseInt(e.target.value)})} style={{ width: '100%', cursor: 'pointer' }} />
                        </div>
                        <div>
                            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: labelColor, marginBottom: '4px' }}>
                                <span>텍스트 크기 (Size)</span> <span>{textOverlay.size}px</span>
                            </label>
                            <input type="range" min="10" max="150" value={textOverlay.size} onChange={e => setTextOverlay({...textOverlay, size: parseInt(e.target.value)})} style={{ width: '100%', cursor: 'pointer' }} />
                        </div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#1f2937', padding: '15px', borderRadius: '8px', border: '1px solid #374151' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', color: legibilityMode ? '#FFFFFF' : 'white', fontWeight: legibilityMode ? 'bold' : 'normal' }}>생성 옵션 (Generation)</h3>
                    
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '8px' }}>모델 선택 (Model)</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <label style={{ flex: 1, padding: '10px', borderRadius: '8px', border: modelType === 'flash' ? '1px solid #fbbf24' : '1px solid #4b5563', backgroundColor: modelType === 'flash' ? 'rgba(251, 191, 36, 0.1)' : 'transparent', cursor: 'pointer', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <input type="radio" checked={modelType === 'flash'} onChange={() => setModelType('flash')} style={{ display: 'none' }} />
                                <span style={{ fontWeight: 'bold', color: modelType === 'flash' ? '#fbbf24' : labelColor }}>Standard</span>
                                <span style={{ fontSize: '10px', color: '#6b7280' }}>(Fast)</span>
                            </label>
                            <label style={{ flex: 1, padding: '10px', borderRadius: '8px', border: modelType === 'pro' ? '1px solid #e11d48' : '1px solid #4b5563', backgroundColor: modelType === 'pro' ? 'rgba(225, 29, 72, 0.1)' : 'transparent', cursor: 'pointer', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <input type="radio" checked={modelType === 'pro'} onChange={() => setModelType('pro')} style={{ display: 'none' }} />
                                <span style={{ fontWeight: 'bold', color: modelType === 'pro' ? '#e11d48' : labelColor }}>Pro</span>
                                <span style={{ fontSize: '10px', color: '#6b7280' }}>(HD)</span>
                            </label>
                        </div>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '13px', color: labelColor, marginBottom: '5px' }}>이미지 크기 (Ratio)</label>
                        <select 
                            value={selectedSizePreset} 
                            onChange={(e) => setSelectedSizePreset(Number(e.target.value))} 
                            style={{ width: '100%', padding: '10px', backgroundColor: '#111827', color: 'white', border: '1px solid #4b5563', borderRadius: '6px', fontSize: '13px' }}
                        >
                            {IMAGE_SIZE_PRESETS.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button 
                        onClick={generateCoverArt}
                        disabled={loading}
                        style={{ 
                            width: '100%', padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', 
                            borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        {loading ? 'Generating...' : <><span className="material-symbols-outlined">auto_awesome</span> 앨범 커버 생성</>}
                    </button>
                </div>
            </div>

            {/* Column 3: Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                 <h2 style={{ fontSize: '18px', borderBottom: '1px solid #374151', paddingBottom: '15px', margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
                    <span className="material-symbols-outlined">image</span> 미리보기 (Preview)
                 </h2>
                
                 <div style={{ 
                    width: '100%', 
                    aspectRatio: previewAspectRatio, 
                    backgroundColor: '#111827', 
                    borderRadius: '12px', border: '1px solid #374151', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    overflow: 'hidden', marginBottom: '10px', position: 'relative',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                    transition: 'aspect-ratio 0.3s ease'
                }}>
                    {project.coverImage ? (
                        <>
                            <img src={project.coverImage} alt="Album Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{
                                position: 'absolute',
                                top: `${textOverlay.y}%`,
                                left: `${textOverlay.x}%`,
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center',
                                color: currentEffectStyle.color || textColor,
                                pointerEvents: 'none',
                                width: '100%',
                                ...currentEffectStyle
                            }}>
                                <div style={{ 
                                    fontFamily: fontType, 
                                    fontSize: `${textOverlay.size}px`, 
                                    fontWeight: 'bold',
                                    marginBottom: `${textOverlay.size * 0.2}px`
                                }}>
                                    {artTitle}
                                </div>
                                <div style={{ 
                                    fontFamily: fontType, 
                                    fontSize: `${textOverlay.size * 0.5}px`, 
                                    opacity: 0.9 
                                }}>
                                    {artistName}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ color: '#4b5563', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '64px' }}>image</span>
                            <span>No Image</span>
                            <span style={{ fontSize: '11px', color: '#6b7280' }}>Ratio: {currentRatioConfig.ratio}</span>
                        </div>
                    )}
                </div>

                {project.coverImage && (
                    <button 
                        onClick={handleDownload}
                        style={{ 
                            width: '100%', padding: '12px', backgroundColor: '#374151', 
                            color: legibilityMode ? '#FFFFFF' : '#d1d5db', 
                            border: '1px solid #4b5563', borderRadius: '8px', 
                            cursor: 'pointer', fontWeight: 'bold', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            fontSize: '13px'
                        }}
                    >
                        <span className="material-symbols-outlined">download</span> 이미지 다운로드
                    </button>
                )}
            </div>
        </div>
    );
};

// --- TAB: Export ---
const MetadataDraftForm = ({ project, onCancel, legibilityMode }: any) => {
    const [artist, setArtist] = useState(project.djName || 'DJ Doberman');
    const [artistSamples, setArtistSamples] = useState<string[]>(['DJ Doberman']);
    const [generatedTags, setGeneratedTags] = useState<string>('');

    useEffect(() => {
        const saved = localStorage.getItem('suno_export_artists');
        if (saved) { setArtistSamples(JSON.parse(saved)); }
    }, []);

    useEffect(() => {
        const baseTags = [project.genre, project.subGenre, project.mood, 'NewMusic', 'OriginalSong', 'SunoAI', 'AI_Music', project.vocalType, 'MusicProduction', 'Trending', 'Kpop', 'Latin', 'Dance'];
        const uniqueTags = Array.from(new Set(baseTags.filter(t => t && t.trim() !== ''))).slice(0, 10);
        const formattedTags = uniqueTags.map(t => `#${t.replace(/\s+/g, '')}`).join(' ');
        setGeneratedTags(formattedTags);
    }, [project]);

    const saveArtistSamples = (list: string[]) => {
        setArtistSamples(list);
        localStorage.setItem('suno_export_artists', JSON.stringify(list));
    };

    const addArtist = () => {
        if (artist && !artistSamples.includes(artist)) {
            saveArtistSamples([...artistSamples, artist]);
        }
    };

    const removeArtist = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        saveArtistSamples(artistSamples.filter(a => a !== name));
    };

    const copyAll = () => {
        const text = `Title: ${project.title}\nArtist: ${artist}\n\n[Tags]\n${generatedTags}\n\n[Lyrics]\n${project.lyrics || '(No lyrics generated)'}`.trim();
        navigator.clipboard.writeText(text);
        alert('🎵 메타데이터 초안이 복사되었습니다!');
    };

    const labelColor = legibilityMode ? '#F9FAF8' : '#9ca3af';

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'left', backgroundColor: '#1f2937', color: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #374151', padding: '10px' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111827', flexWrap: 'wrap', gap: '15px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: legibilityMode ? 'bold' : 'normal' }}>
                    <span className="material-symbols-outlined" style={{ color: '#fbbf24' }}>description</span>
                    메타데이터 초안 생성
                </h2>
                <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
            <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(350px, 100%), 1fr))', gap: '30px' }}>
                    <div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', color: labelColor, fontSize: '13px', marginBottom: '5px' }}>제목 (Title)</label>
                            <input type="text" value={project.title} readOnly style={{ width: '100%', padding: '10px', backgroundColor: '#374151', border: '1px solid #4b5563', color: 'white', borderRadius: '6px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', color: labelColor, fontSize: '13px', marginBottom: '5px' }}>아티스트 (Artist)</label>
                            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                                <input type="text" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist Name" style={{ flex: 1, padding: '10px', backgroundColor: '#374151', border: '1px solid #4b5563', color: 'white', borderRadius: '6px', minWidth: 0 }} />
                                <button onClick={addArtist} style={{ padding: '0 12px', backgroundColor: '#374151', border: '1px solid #4b5563', color: '#10b981', borderRadius: '6px', cursor: 'pointer' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {artistSamples.map((a, i) => (
                                    <div key={i} onClick={() => setArtist(a)} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px', backgroundColor: '#111827', border: '1px solid #4b5563', color: legibilityMode ? '#FFFFFF' : '#d1d5db', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {a} <span onClick={(e) => removeArtist(a, e)} style={{ fontSize: '14px', color: '#ef4444', fontWeight: 'bold' }}>×</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ display: 'block', color: labelColor, fontSize: '13px', marginBottom: '5px' }}>가사 (Lyrics)</label>
                        <textarea value={project.lyrics || ''} readOnly style={{ flex: 1, padding: '10px', backgroundColor: '#374151', border: '1px solid #4b5563', color: '#e5e7eb', borderRadius: '6px', resize: 'none', fontFamily: 'monospace', minHeight: '300px', boxSizing: 'border-box' }} />
                    </div>
                </div>
                <div style={{ marginTop: '30px', textAlign: 'center' }}>
                    <button onClick={copyAll} style={{ padding: '12px 30px', backgroundColor: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-outlined">content_copy</span> 전체 복사
                    </button>
                </div>
            </div>
        </div>
    );
};

const ExportTab = ({ project, onExportJSON, legibilityMode }: { project: Project, onExportJSON: () => void, legibilityMode: boolean }) => {
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  if (showMetadataForm) {
      return <MetadataDraftForm project={project} onCancel={() => setShowMetadataForm(false)} legibilityMode={legibilityMode} />;
  }
  const titleColor = legibilityMode ? '#FFFFFF' : '#f3f4f6';
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px' }}>
      <h2 style={{ borderBottom: '1px solid #374151', paddingBottom: '15px', marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: titleColor, fontWeight: legibilityMode ? 'bold' : 'normal' }}>
        <span className="material-symbols-outlined" style={{ color: '#fbbf24', fontSize: '28px' }}>publish</span>
        배포 및 내보내기 (Export)
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '30px' }}>
          <div onClick={onExportJSON} style={{ backgroundColor: '#1f2937', padding: '40px 20px', borderRadius: '24px', border: '1px solid #374151', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', transition: 'all 0.2s', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '40px' }}>download</span>
              </div>
              <div>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: 'white' }}>프로젝트 백업 (JSON)</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: legibilityMode ? '#E5E7EB' : '#9ca3af', lineHeight: '1.6' }}>설정과 데이터를 JSON 파일로 저장합니다.</p>
              </div>
          </div>
          <div onClick={() => setShowMetadataForm(true)} style={{ backgroundColor: '#1f2937', padding: '40px 20px', borderRadius: '24px', border: '1px solid #374151', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', transition: 'all 0.2s', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '40px' }}>description</span>
              </div>
              <div>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: 'white' }}>메타데이터 초안 생성</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: legibilityMode ? '#E5E7EB' : '#9ca3af', lineHeight: '1.6' }}>업로드를 위한 제목, 태그 등을 생성합니다.</p>
              </div>
          </div>
      </div>
    </div>
  );
};

// --- Studio Component ---
const Studio = ({ project, onUpdate, onBack, onExportJSON, legibilityMode }: { project: Project, onUpdate: (u: Partial<Project>) => void, onBack: () => void, onExportJSON: () => void, legibilityMode: boolean }) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('CONCEPT');
  const [showManual, setShowManual] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);

  useEffect(() => {
    const handleResize = () => {
        if (window.innerWidth <= 768) { setIsSidebarOpen(false); }
        else { setIsSidebarOpen(true); }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderContent = () => {
    switch(activeTab) {
      case 'CONCEPT': return <ConceptTab project={project} onUpdate={onUpdate} legibilityMode={legibilityMode} />;
      case 'STRUCTURE': return <StructureTab project={project} onUpdate={onUpdate} legibilityMode={legibilityMode} />;
      case 'LYRICS': return <LyricsTab project={project} onUpdate={onUpdate} legibilityMode={legibilityMode} />;
      case 'SOUND': return <SoundTab project={project} onUpdate={onUpdate} legibilityMode={legibilityMode} />;
      case 'ART': return <ArtTab project={project} onUpdate={onUpdate} legibilityMode={legibilityMode} />;
      case 'EXPORT': return <ExportTab project={project} onExportJSON={onExportJSON} legibilityMode={legibilityMode} />;
      default: return <div>Unknown Tab</div>;
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Mobile Toggle Sidebar */}
      {window.innerWidth <= 768 && (
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{ 
              position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000,
              width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#e11d48',
              border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.4)'
          }}
        >
          <span className="material-symbols-outlined">{isSidebarOpen ? 'close' : 'menu'}</span>
        </button>
      )}

      <nav style={{ 
          width: '80px', 
          backgroundColor: '#111827', 
          borderRight: '1px solid #374151', 
          display: isSidebarOpen ? 'flex' : 'none', 
          flexDirection: 'column', 
          alignItems: 'center', 
          paddingTop: '20px', 
          gap: '15px',
          height: '100%',
          position: window.innerWidth <= 768 ? 'absolute' : 'relative',
          zIndex: 900,
          transition: 'transform 0.3s'
      }}>
        <NavButton active={activeTab === 'CONCEPT'} onClick={() => { setActiveTab('CONCEPT'); if(window.innerWidth <= 768) setIsSidebarOpen(false); }} icon="lightbulb" label="기획" legibilityMode={legibilityMode} />
        <NavButton active={activeTab === 'STRUCTURE'} onClick={() => { setActiveTab('STRUCTURE'); if(window.innerWidth <= 768) setIsSidebarOpen(false); }} icon="view_timeline" label="구조" legibilityMode={legibilityMode} />
        <NavButton active={activeTab === 'LYRICS'} onClick={() => { setActiveTab('LYRICS'); if(window.innerWidth <= 768) setIsSidebarOpen(false); }} icon="lyrics" label="가사" legibilityMode={legibilityMode} />
        <NavButton active={activeTab === 'SOUND'} onClick={() => { setActiveTab('SOUND'); if(window.innerWidth <= 768) setIsSidebarOpen(false); }} icon="piano" label="사운드" legibilityMode={legibilityMode} />
        <NavButton active={activeTab === 'ART'} onClick={() => { setActiveTab('ART'); if(window.innerWidth <= 768) setIsSidebarOpen(false); }} icon="image" label="아트" legibilityMode={legibilityMode} />
        <NavButton active={activeTab === 'EXPORT'} onClick={() => { setActiveTab('EXPORT'); if(window.innerWidth <= 768) setIsSidebarOpen(false); }} icon="publish" label="배포" legibilityMode={legibilityMode} />
        <div style={{ height: '1px', backgroundColor: '#374151', width: '50%', margin: '5px auto' }}></div>
        <NavButton active={showManual} onClick={() => { setShowManual(true); if(window.innerWidth <= 768) setIsSidebarOpen(false); }} icon="menu_book" label="매뉴얼" legibilityMode={legibilityMode} />
      </nav>
      
      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#1f2937', padding: 'min(30px, 4vw)', width: '100%', boxSizing: 'border-box' }}>
        {renderContent()}
      </div>
      {showManual && <ManualModal onClose={() => setShowManual(false)} />}
    </div>
  );
};

// --- Dashboard Component ---
const Dashboard = ({ projects, onCreate, onOpen, onDelete, onExport, legibilityMode }: any) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({ genre: 'Salsa', subGenre: 'Salsa Dura', mood: 'Happy & Energetic', title: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newProjectForm.title.trim()) return alert('제목을 입력하세요');
    onCreate(newProjectForm);
    setIsModalOpen(false);
    setNewProjectForm({ genre: 'Salsa', subGenre: 'Salsa Dura', mood: 'Happy & Energetic', title: '' });
  };

  const handleGenreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === 'Custom') {
      setNewProjectForm({ ...newProjectForm, genre: selected, subGenre: '' });
    } else {
      const genreObj = GENRES.find(g => g.label === selected);
      setNewProjectForm({ 
        ...newProjectForm, 
        genre: selected, 
        subGenre: genreObj && genreObj.subgenres.length > 0 ? genreObj.subgenres[0] : '' 
      });
    }
  };

  const titleColor = legibilityMode ? '#FFFFFF' : '#f3f4f6';
  const labelColor = legibilityMode ? '#E5E7EB' : '#9ca3af';

  const selectedGenreObj = GENRES.find(g => g.label === newProjectForm.genre);

  return (
    <div style={{ padding: 'min(40px, 5vw)', width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: 'clamp(1.5rem, 6vw, 2rem)', fontWeight: 'bold', marginBottom: '10px', color: titleColor }}>Projects</h2>
            <p style={{ color: labelColor, margin: 0 }}>Manage your music productions and ideas</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} style={{ backgroundColor: '#e11d48', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.2)' }}>
            <span className="material-symbols-outlined">add</span> New Project
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '24px' }}>
          <div onClick={() => setIsModalOpen(true)} style={{ backgroundColor: 'rgba(31, 41, 55, 0.4)', borderRadius: '16px', border: '2px dashed #4b5563', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: '280px', transition: 'all 0.2s' }}>
             <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: '#e11d48' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>add</span>
             </div>
             <span style={{ fontSize: '16px', fontWeight: 'bold', color: labelColor }}>Create New Project</span>
          </div>
          {projects.map((p: Project) => (
            <div key={p.id} onClick={() => onOpen(p.id)} style={{ backgroundColor: '#1f2937', borderRadius: '16px', border: '1px solid #374151', display: 'flex', flexDirection: 'column', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ height: '180px', width: '100%', position: 'relative', backgroundColor: '#111827' }}>
                    {p.coverImage ? <img src={p.coverImage} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)' }}><span style={{ fontSize: '48px', opacity: 0.2 }}>🎵</span></div>}
                     <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px', zIndex: 10 }}>
                         <button onClick={(e) => { e.stopPropagation(); onExport(p); }} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', border: 'none', color: '#fff', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span></button>
                         <button onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', border: 'none', color: '#fff', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span></button>
                    </div>
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 12px 0', color: 'white' }}>{p.title || 'Untitled Project'}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                        <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', backgroundColor: '#374151', color: legibilityMode ? '#FFFFFF' : '#9ca3af', fontWeight: '500' }}>{p.genre}</span>
                        {p.subGenre && <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(225, 29, 72, 0.1)', color: '#e11d48', border: '1px solid rgba(225, 29, 72, 0.2)', fontWeight: '500' }}>{p.subGenre}</span>}
                    </div>
                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #374151', paddingTop: '15px' }}>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>{new Date(p.createdAt).toLocaleDateString()}</span>
                        <span style={{ fontSize: '13px', color: '#818cf8', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>Open Studio <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span></span>
                    </div>
                </div>
            </div>
          ))}
        </div>
      </div>
      {deleteId && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}><div style={{ backgroundColor: '#1f2937', padding: '24px', borderRadius: '16px', border: '1px solid #374151', width: 'min(320px, 90vw)', textAlign: 'center' }}><h3 style={{ margin: '0 0 24px 0', color: 'white' }}>정말로 삭제하시겠습니까?</h3><div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}><button onClick={() => setDeleteId(null)} style={{ padding: '10px 20px', backgroundColor: '#374151', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>취소</button><button onClick={() => { onDelete(deleteId); setDeleteId(null); }} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>삭제</button></div></div></div>}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#1f2937', padding: '30px', borderRadius: '16px', width: 'min(500px, 95vw)', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ marginTop: 0, color: 'white' }}>Start New Project</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', margin: '20px 0' }}>
                    <div>
                        <label style={{ display: 'block', color: labelColor, fontSize: '13px', marginBottom: '5px' }}>Project Name</label>
                        <input type="text" value={newProjectForm.title} onChange={e => setNewProjectForm({...newProjectForm, title: e.target.value})} placeholder="Enter project name..." style={{ width: '100%', padding: '12px', backgroundColor: '#111827', border: '1px solid #374151', color: 'white', borderRadius: '8px', boxSizing: 'border-box' }} />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', color: labelColor, fontSize: '13px', marginBottom: '5px' }}>Genre</label>
                            <select value={newProjectForm.genre} onChange={handleGenreChange} style={{ width: '100%', padding: '12px', backgroundColor: '#111827', color: 'white', border: '1px solid #374151', borderRadius: '8px' }}>
                                {GENRES.map(g => <option key={g.label} value={g.label}>{g.label}</option>)}
                            </select>
                        </div>
                        {selectedGenreObj && selectedGenreObj.subgenres.length > 0 && (
                            <div>
                                <label style={{ display: 'block', color: labelColor, fontSize: '13px', marginBottom: '5px' }}>Sub-Genre</label>
                                <select value={newProjectForm.subGenre} onChange={e => setNewProjectForm({...newProjectForm, subGenre: e.target.value})} style={{ width: '100%', padding: '12px', backgroundColor: '#111827', color: 'white', border: '1px solid #374151', borderRadius: '8px' }}>
                                    {selectedGenreObj.subgenres.map(sg => <option key={sg} value={sg}>{sg}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={{ display: 'block', color: labelColor, fontSize: '13px', marginBottom: '5px' }}>Mood</label>
                        <select value={newProjectForm.mood} onChange={e => setNewProjectForm({...newProjectForm, mood: e.target.value})} style={{ width: '100%', padding: '12px', backgroundColor: '#111827', color: 'white', border: '1px solid #374151', borderRadius: '8px' }}>
                            {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <button onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleCreate} style={{ padding: '10px 24px', backgroundColor: '#e11d48', color: 'white', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>Create Project</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const ApiKeySelection = ({ onComplete }: { onComplete: () => void }) => {
  const [loading, setLoading] = useState(false);
  const handleSelect = async () => {
    setLoading(true);
    try {
        if ((window as any).aistudio && (window as any).aistudio.openSelectKey) { await (window as any).aistudio.openSelectKey(); }
        onComplete();
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111827', color: 'white', gap: '20px', padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>🎹</div>
        <h1 style={{ fontSize: 'clamp(1.5rem, 8vw, 2.5rem)', margin: 0 }}>Welcome to Suno Studio Pro</h1>
        <p style={{ color: '#9ca3af', maxWidth: '400px' }}>To generate high-quality content, please select a valid Google Cloud API Key.</p>
        <button onClick={handleSelect} disabled={loading} style={{ padding: '12px 24px', backgroundColor: '#e11d48', color: 'white', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
            {loading ? 'Connecting...' : 'Select API Key to Start'}
        </button>
    </div>
  );
};

const Header = ({ view, project, onBack, onSave, onImport, onRemix, legibilityMode, onToggleLegibility }: any) => {
    return (
        <div style={{ 
            height: 'auto', 
            minHeight: '60px',
            backgroundColor: '#111827', 
            borderBottom: '1px solid #374151', 
            display: 'flex', 
            alignItems: 'center', 
            padding: '10px 20px', 
            justifyContent: 'space-between', 
            boxSizing: 'border-box',
            flexWrap: 'wrap',
            gap: '15px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={onBack}>
                    <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#e11d48' }}>piano</span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: legibilityMode ? '#FFFFFF' : 'white' }}>Suno Studio Pro</span>
                </div>
                {view === 'STUDIO' && project && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: window.innerWidth > 480 ? '1px solid #374151' : 'none', paddingLeft: window.innerWidth > 480 ? '15px' : '0' }}>
                        <span style={{ color: legibilityMode ? '#FFFFFF' : '#d1d5db', fontSize: '14px', fontWeight: 'bold' }}>{project.title}</span>
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>/</span>
                        <span style={{ color: legibilityMode ? '#FFFFFF' : '#9ca3af', fontSize: '14px' }}>{project.genre}</span>
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Legibility Mode Toggle */}
                <button 
                    onClick={onToggleLegibility}
                    style={{ 
                        padding: '6px 12px', 
                        backgroundColor: legibilityMode ? '#fbbf24' : '#374151', 
                        color: legibilityMode ? '#000000' : '#FFFFFF', 
                        border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                        fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>contrast</span>
                    {window.innerWidth > 600 ? (legibilityMode ? '가독성 ON' : '가독성 OFF') : ''}
                </button>

                {view === 'DASHBOARD' && (
                    <>
                        <input type="file" id="import-json" style={{ display: 'none' }} accept=".json" onChange={onImport} />
                        <label htmlFor="import-json" style={{ padding: '8px 16px', backgroundColor: '#374151', color: '#d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>folder_open</span>
                            {window.innerWidth > 600 ? '프로젝트 불러오기' : ''}
                        </label>
                    </>
                )}
                {view === 'STUDIO' && (
                    <>
                        <button onClick={onRemix} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#818cf8', borderRadius: '6px', fontSize: '13px', border: '1px solid #818cf8', cursor: 'pointer' }}>Remix</button>
                        <button onClick={onSave} style={{ padding: '8px 16px', backgroundColor: '#374151', color: '#d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', border: 'none' }}>Save</button>
                    </>
                )}
            </div>
        </div>
    );
};

const App = () => {
    const [view, setView] = useState<ViewState>('DASHBOARD');
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [apiKeySet, setApiKeySet] = useState(false);
    const [legibilityMode, setLegibilityMode] = useState(() => {
        const saved = localStorage.getItem('suno_legibility_mode');
        return saved === 'true';
    });

    useEffect(() => {
        const checkApiKey = async () => {
            if (process.env.API_KEY) { setApiKeySet(true); }
            else if (window.aistudio && window.aistudio.hasSelectedApiKey) {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setApiKeySet(hasKey);
            }
        };
        checkApiKey();
    }, []);

    const toggleLegibility = () => {
        const newVal = !legibilityMode;
        setLegibilityMode(newVal);
        localStorage.setItem('suno_legibility_mode', String(newVal));
    };

    const handleCreateProject = (form: any) => {
        const newProject: Project = {
            id: Date.now().toString(),
            title: form.title,
            genre: form.genre,
            subGenre: form.subGenre,
            mood: form.mood,
            styleDescription: '',
            bpm: 0,
            key: '',
            createdAt: Date.now(),
            generatedTitles: [],
            structure: [],
            lyrics: '',
            sunoPrompt: '',
            instruments: GENRE_DEFAULTS[form.genre] || [],
            vocalType: 'Male'
        };
        const updated = [newProject, ...projects];
        setProjects(updated);
        localStorage.setItem('suno_projects', JSON.stringify(updated));
        setCurrentProjectId(newProject.id);
        setView('STUDIO');
    };

    const handleUpdateProject = (updates: Partial<Project>) => {
        if (!currentProjectId) return;
        const updated = projects.map(p => p.id === currentProjectId ? { ...p, ...updates } : p);
        setProjects(updated);
        localStorage.setItem('suno_projects', JSON.stringify(updated));
    };

    const handleDeleteProject = (id: string) => {
        const updated = projects.filter(p => p.id !== id);
        setProjects(updated);
        localStorage.setItem('suno_projects', JSON.stringify(updated));
    };

    const handleOpenProject = (id: string) => {
        setCurrentProjectId(id);
        setView('STUDIO');
    };

    const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string);
                if (imported.id && imported.title) {
                    const newId = Date.now().toString();
                    const newProject = { ...imported, id: newId };
                    const updated = [newProject, ...projects];
                    setProjects(updated);
                    localStorage.setItem('suno_projects', JSON.stringify(updated));
                    alert('Project Imported Successfully!');
                }
            } catch (err) {
                alert('Invalid JSON file');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleExportProject = (p: Project) => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(p));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${p.title || 'project'}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleRemix = () => {
        if (!currentProjectId) return;
        const current = projects.find(p => p.id === currentProjectId);
        if (!current) return;
        const remix: Project = {
            ...current,
            id: Date.now().toString(),
            title: `${current.title} (Remix)`,
            createdAt: Date.now()
        };
        const updated = [remix, ...projects];
        setProjects(updated);
        localStorage.setItem('suno_projects', JSON.stringify(updated));
        setCurrentProjectId(remix.id);
        alert('Remix created!');
    };

    useEffect(() => {
        const saved = localStorage.getItem('suno_projects');
        if (saved) setProjects(JSON.parse(saved));
    }, []);

    const activeProject = projects.find(p => p.id === currentProjectId);

    if (!apiKeySet) {
        return <ApiKeySelection onComplete={() => setApiKeySet(true)} />;
    }

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", backgroundColor: '#111827', color: 'white' }}>
            <Header 
                view={view} 
                project={activeProject} 
                onBack={() => setView('DASHBOARD')} 
                onSave={() => activeProject && handleExportProject(activeProject)}
                onImport={handleImportProject}
                onRemix={handleRemix}
                legibilityMode={legibilityMode}
                onToggleLegibility={toggleLegibility}
            />
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {view === 'DASHBOARD' && (
                    <Dashboard 
                        projects={projects} 
                        onCreate={handleCreateProject} 
                        onOpen={handleOpenProject} 
                        onDelete={handleDeleteProject}
                        onExport={handleExportProject}
                        legibilityMode={legibilityMode}
                    />
                )}
                {view === 'STUDIO' && activeProject && (
                    <Studio 
                        project={activeProject} 
                        onUpdate={handleUpdateProject} 
                        onBack={() => setView('DASHBOARD')} 
                        onExportJSON={() => handleExportProject(activeProject)}
                        legibilityMode={legibilityMode}
                    />
                )}
            </div>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);