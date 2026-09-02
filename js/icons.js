/* AMS Tracking — hand-drawn icon set.
   Every icon is drawn as wobbly ink strokes (round caps, deliberately
   imperfect curves) on a 24×24 grid and inherits currentColor. */
'use strict';

const ICON_PATHS = {

    /* ---- habit icons ---- */

    meditate: `
        <ellipse cx="12" cy="5.2" rx="2" ry="2.1" transform="rotate(-6 12 5.2)"/>
        <path d="M8.1 15.9 C8.5 11.8 9.4 9.6 12 9.5 C14.7 9.6 15.5 12 15.9 15.7"/>
        <path d="M8.4 11.9 C6.9 12.8 5.9 13.9 5.4 15.3 M15.7 11.8 C17.2 12.7 18.2 13.8 18.7 15.2"/>
        <path d="M5.9 18 C8 16.3 10 15.7 12 15.7 C14 15.7 16.1 16.4 18.2 17.9"/>`,

    dumbbell: `
        <path d="M8.6 12.1 L15.5 11.9"/>
        <path d="M7 8.9 L6.8 15.2 M4.9 10.2 L4.8 14"/>
        <path d="M17.1 8.8 L17.3 15.1 M19.2 10 L19.3 13.9"/>`,

    book: `
        <path d="M12 6.5 L12 18.2"/>
        <path d="M12 6.5 C10.1 4.9 7.3 4.6 4.7 5.4 L4.9 16.9 C7.4 16.3 10.1 16.6 12 18.1"/>
        <path d="M12 6.5 C13.9 4.9 16.7 4.6 19.3 5.4 L19.1 16.9 C16.6 16.3 13.9 16.6 12 18.1"/>`,

    guitar: `
        <path d="M14.7 9.4 L19.5 4.4 M15.5 10.3 L20.3 5.3 M19.5 4.4 L20.3 5.3"/>
        <path d="M14.8 9.6 C13.4 8.4 11.2 8.7 10.1 10.1 C9.2 11.2 9.1 12.7 9.8 13.8 C8.3 14 6.9 15.1 6.4 16.6 C5.7 18.8 7.2 21 9.5 21.3 C11.8 21.6 14 20 14.3 17.8 C14.5 16.5 14 15.3 13.1 14.4 C14.4 14.1 15.5 13.1 15.8 11.8"/>
        <ellipse cx="10.7" cy="15.7" rx="1.2" ry="1.1" transform="rotate(10 10.7 15.7)"/>`,

    run: `
        <ellipse cx="14.6" cy="4.7" rx="1.8" ry="1.9" transform="rotate(8 14.6 4.7)"/>
        <path d="M13.9 6.8 C12.9 8.5 12.3 10.3 12 12.2"/>
        <path d="M13.5 8.1 L16.7 9.5 M13.3 8.4 L10.1 9.7"/>
        <path d="M12 12.2 C13.2 13.2 14.1 14.2 14.8 15.4 L14 18.9 M12 12.2 C11 13.2 10 14 8.9 14.6 L5.9 14.2"/>
        <path d="M4.6 7.5 L7.5 7.3 M3.9 10.7 L6.3 10.6"/>`,

    sunrise: `
        <path d="M3.9 17.6 C9.3 17.2 14.8 17.2 20.2 17.5"/>
        <path d="M8.3 17.3 C8.2 15.2 9.9 13.4 12 13.4 C14.1 13.4 15.8 15.3 15.7 17.3"/>
        <path d="M12 10.2 L12 7.6 M6.6 12.3 L5 10.8 M17.4 12.2 L19 10.7"/>`,

    books: `
        <path d="M5.2 19.2 C9.7 18.8 14.3 18.8 18.8 19.2 C18.9 18.1 18.9 17 18.8 15.9 C14.3 15.5 9.8 15.5 5.3 15.9 C5.2 17 5.2 18.1 5.2 19.2 Z"/>
        <path d="M6.4 15.8 C6.3 14.8 6.3 13.8 6.4 12.8 C10.4 12.4 14.3 12.4 17.9 12.8 C18 13.8 18 14.8 17.9 15.7"/>
        <path d="M7.5 12.7 C7.5 11.8 7.6 10.8 7.8 9.9 C11.1 9.5 14.3 9.5 17.2 9.9 C17.4 10.8 17.5 11.8 17.5 12.7"/>
        <path d="M14.9 9.7 L14.9 12.6"/>`,

    moon: `
        <path d="M13.8 4.1 C10.5 5.1 8.3 8.2 8.5 11.8 C8.7 15.4 11.3 18.3 14.7 18.9 C13 19.9 10.9 20.2 9 19.6 C5.6 18.5 3.4 15.1 3.8 11.5 C4.2 7.9 7 5 10.6 4.3 C11.7 4.1 12.7 4 13.8 4.1 Z"/>
        <path d="M16.9 6.9 L17 7 M18.9 10.5 L19 10.6 M17.6 14.4 L17.7 14.5"/>`,

    drop: `
        <path d="M12 3.9 C14.4 7 16.9 9.9 17 13.1 C17.1 16.4 14.8 19 12 19 C9.2 19 6.9 16.5 7 13.2 C7.1 9.9 9.7 7 12 3.9 Z"/>
        <path d="M9.5 13.3 C9.5 14.7 10.2 15.9 11.2 16.4"/>`,

    apple: `
        <path d="M12 8.9 C10.9 7.6 8.9 7.2 7.4 8.2 C5.6 9.4 5.1 12.1 5.9 14.5 C6.7 16.9 8.6 19.2 10.6 19 C11.1 18.9 11.6 18.6 12 18.3 C12.4 18.7 12.9 19 13.4 19 C15.4 19.2 17.3 16.9 18.1 14.5 C18.9 12.1 18.4 9.4 16.6 8.2 C15.1 7.2 13.1 7.6 12 8.9 Z"/>
        <path d="M12 8.5 C11.9 6.9 12.4 5.5 13.5 4.4"/>
        <path d="M13.4 6.4 C14.2 4.9 15.9 4.3 17.4 4.8 C16.9 6.4 15.2 7.4 13.5 7.1 Z"/>`,

    bike: `
        <ellipse cx="6.5" cy="15.8" rx="3.5" ry="3.4" transform="rotate(-4 6.5 15.8)"/>
        <ellipse cx="17.6" cy="15.7" rx="3.5" ry="3.4" transform="rotate(5 17.6 15.7)"/>
        <path d="M6.5 15.8 L9.9 9.6 L15 9.5 L17.6 15.7 M9.9 9.6 L13.1 15.6 L6.5 15.8"/>
        <path d="M14.4 9.5 L13.7 7.4 L15.6 7.1 M9.2 7.7 L10.9 7.6"/>`,

    pen: `
        <path d="M6 18.9 C6.3 17.1 6.7 15.8 7.3 15.1 L16.3 5.4 C17 4.6 18.2 4.6 18.9 5.3 C19.6 6 19.6 7.2 18.9 7.9 L9.6 17.4 C8.9 18 7.6 18.5 6 18.9 Z"/>
        <path d="M15.4 6.5 L17.8 8.8"/>
        <path d="M12.4 19.3 C14.4 18.9 16.4 18.9 18.4 19.2"/>`,

    tooth: `
        <path d="M8.5 4.8 C6.6 5.2 5.4 7.1 5.6 9.4 C5.7 11 6.3 12.4 6.7 13.9 C7.2 15.8 7.4 17.8 8.2 19.4 C8.5 20 9.3 19.9 9.5 19.3 C10 17.9 10.1 16.3 10.9 15.1 C11.4 14.3 12.6 14.3 13.1 15.1 C13.9 16.3 14 17.9 14.5 19.3 C14.7 19.9 15.5 20 15.8 19.4 C16.6 17.8 16.8 15.8 17.3 13.9 C17.7 12.4 18.3 11 18.4 9.4 C18.6 7.1 17.4 5.2 15.5 4.8 C14.3 4.6 13.2 5.4 12 5.4 C10.8 5.4 9.7 4.6 8.5 4.8 Z"/>`,

    broom: `
        <path d="M18 3.9 L12 11.9"/>
        <path d="M12.2 11.6 C10.4 11.2 8.4 12 7.2 13.6 C6 15.3 5.4 17.6 5.7 19.9 C8 20.1 10.3 19.5 12 18 C13.7 16.6 14.4 14.5 13.6 12.7 Z"/>
        <path d="M8.6 15.6 C8.3 16.9 8.1 18.2 8 19.6 M11 14.2 C11.1 15.7 11 17.2 10.6 18.7"/>`,

    sun: `
        <ellipse cx="12" cy="12.1" rx="3.6" ry="3.5" transform="rotate(7 12 12.1)"/>
        <path d="M12 4.2 L12 6.3 M12 17.9 L12 20 M4.1 12.2 L6.2 12.1 M17.8 12 L19.9 12"/>
        <path d="M6.4 6.6 L7.9 8 M16.1 16.2 L17.6 17.6 M17.5 6.4 L16 7.9 M8 16.1 L6.5 17.5"/>`,

    timer: `
        <ellipse cx="12" cy="13.4" rx="6.3" ry="6.2" transform="rotate(-3 12 13.4)"/>
        <path d="M12 4.3 L12 7.1 M10.2 4.2 L13.9 4.1"/>
        <path d="M12 13.5 L15.1 10.9"/>`,


    heart: `
        <path d="M12 19.3 C8.5 16.6 5.4 13.9 4.6 10.8 C4 8.3 5.5 5.9 8 5.6 C9.6 5.4 11.1 6.2 12 7.5 C12.9 6.2 14.4 5.4 16 5.6 C18.5 5.9 20 8.3 19.4 10.8 C18.6 13.9 15.5 16.7 12 19.3 Z"/>`,

    pulse: `
        <path d="M3.8 12.2 L7.9 12.1 L10 7.4 L13.1 16.9 L15.3 12 L20.2 11.9"/>`,

    music: `
        <path d="M9.4 17.3 L9.6 6.3 C12.4 5.5 15.2 5.5 17.9 6.4 L17.7 15.6"/>
        <ellipse cx="7.6" cy="17.5" rx="2" ry="1.6" transform="rotate(-14 7.6 17.5)"/>
        <ellipse cx="15.9" cy="15.8" rx="2" ry="1.6" transform="rotate(-14 15.9 15.8)"/>
        <path d="M9.6 9.4 C12.4 8.7 15.1 8.7 17.8 9.4"/>`,

    bed: `
        <path d="M4 17.9 L4.1 7.9 M4 15.9 C9.3 15.6 14.7 15.6 20 15.9 M20 17.9 L20 12.9 C20 11.4 18.9 10.4 17.4 10.4 L10.7 10.4 C9.7 10.4 9 11.1 9 12.1 L9 15.6"/>
        <ellipse cx="6.5" cy="12.6" rx="1.5" ry="1.4" transform="rotate(8 6.5 12.6)"/>`,

    pill: `
        <path d="M7.4 5.9 C9 4.5 11.5 4.6 12.9 6.1 L17.9 11.4 C19.3 12.9 19.2 15.3 17.7 16.7 C16.2 18.1 13.8 18 12.4 16.5 L7.3 11.2 C5.9 9.7 6 7.3 7.4 5.9 Z"/>
        <path d="M9.9 8.7 L15.2 14.1"/>`,

    glass: `
        <path d="M6.8 4.8 L8.3 19.2 C8.4 19.7 8.7 20 9.2 20 L14.8 20 C15.3 20 15.6 19.7 15.7 19.2 L17.2 4.8"/>
        <path d="M6.8 4.8 C10.2 4.4 13.8 4.4 17.2 4.8"/>
        <path d="M8.1 9.5 C10.7 9.2 13.3 9.2 15.9 9.5"/>`,

    coffee: `
        <path d="M5.4 8.7 C8.9 8.4 12.4 8.4 15.9 8.7 L15.3 17.6 C15.2 18.7 14.4 19.4 13.3 19.4 L8 19.4 C6.9 19.4 6.1 18.7 6 17.6 Z"/>
        <path d="M16 10.4 C17.8 10.3 19 11.4 18.9 12.9 C18.8 14.4 17.5 15.3 15.7 15.2"/>
        <path d="M8.8 6.3 C8.6 5.3 9.1 4.4 9.9 3.8 M12.5 6.3 C12.3 5.3 12.8 4.4 13.6 3.8"/>`,

    phoneOff: `
        <path d="M8.4 4.5 C10.8 4.3 13.2 4.3 15.6 4.5 C15.9 9.5 15.9 14.5 15.6 19.5 C13.2 19.7 10.8 19.7 8.4 19.5 C8.1 14.5 8.1 9.5 8.4 4.5 Z"/>
        <path d="M10.7 17.2 L13.3 17.1"/>
        <path d="M5.2 4.2 L18.9 19.8"/>`,

    smokeOff: `
        <path d="M4.4 14.7 L16.3 14.6 L16.4 17.5 L4.5 17.6 Z M18.1 14.6 L18.2 17.5"/>
        <path d="M17.4 11.7 C17.1 10.6 17.6 9.6 18.5 9"/>
        <path d="M6 20.6 L18.4 10.9"/>`,

    wineOff: `
        <path d="M8 4.6 C10.7 4.3 13.3 4.3 16 4.6 C16.2 7.9 14.5 10.6 12 10.7 C9.5 10.6 7.8 7.9 8 4.6 Z"/>
        <path d="M12 10.7 L12 17.7 M8.8 19.3 C10.9 18.9 13.1 18.9 15.2 19.3"/>
        <path d="M5.4 3.5 L18.7 20"/>`,

    leaf: `
        <path d="M6.2 17.8 C4.8 13 6.7 8.1 11 6 C13.3 4.9 15.9 4.6 18.4 5.2 C19 9.1 17.8 13.1 14.8 15.7 C12.4 17.8 9.1 18.5 6.2 17.8 Z"/>
        <path d="M6.9 17.3 C9.9 13.6 13.3 10.3 17.3 7.4"/>`,

    shoe: `
        <path d="M4.6 16.9 C4.5 14.9 4.6 12.9 4.9 11 C6.4 11.7 7.9 11.5 9.2 10.6 C10 11.9 11.2 12.9 12.7 13.3 C15.4 14 18 15 19.4 16.6 C19.5 17.1 19.2 17.5 18.7 17.5 L5.3 17.4 C4.9 17.4 4.6 17.2 4.6 16.9 Z"/>
        <path d="M10.7 13.9 L11.6 12.6 M12.9 14.7 L13.8 13.5"/>`,

    waves: `
        <path d="M4 8.4 C5.6 6.9 7.6 6.9 9.2 8.3 C10.8 9.7 12.9 9.7 14.6 8.3 C16.2 6.9 18.3 6.9 20 8.2"/>
        <path d="M4 12.6 C5.6 11.1 7.6 11.1 9.2 12.5 C10.8 13.9 12.9 13.9 14.6 12.5 C16.2 11.1 18.3 11.1 20 12.4"/>
        <path d="M4 16.8 C5.6 15.3 7.6 15.3 9.2 16.7 C10.8 18.1 12.9 18.1 14.6 16.7 C16.2 15.3 18.3 15.3 20 16.6"/>`,

    kettlebell: `
        <path d="M9 9.3 C8.2 7 9.6 4.7 12 4.6 C14.4 4.5 15.9 6.8 15.2 9.2"/>
        <ellipse cx="12.1" cy="14.3" rx="5.7" ry="5.4" transform="rotate(-4 12.1 14.3)"/>`,

    bulb: `
        <path d="M9.5 17.4 C9.4 15.9 8.8 14.6 7.8 13.4 C6.6 11.9 6.3 9.9 7.1 8.1 C8.1 5.9 10.3 4.5 12.7 4.7 C15.5 4.9 17.8 7.3 17.8 10.2 C17.8 11.5 17.3 12.7 16.4 13.6 C15.4 14.7 14.8 15.9 14.7 17.4 Z"/>
        <path d="M10.1 19.3 C11.4 19.5 12.9 19.5 14.2 19.3"/>`,

    camera: `
        <path d="M4.9 8.3 C6.1 8.1 7.3 8 8.5 7.9 L9.8 6 C10 5.7 10.2 5.6 10.5 5.6 L13.5 5.6 C13.8 5.6 14 5.7 14.2 6 L15.5 7.9 C16.7 8 17.9 8.1 19.1 8.3 C19.4 11.6 19.4 14.9 19.1 18.2 C14.4 18.6 9.6 18.6 4.9 18.2 C4.6 14.9 4.6 11.6 4.9 8.3 Z"/>
        <ellipse cx="12" cy="13" rx="3.1" ry="3" transform="rotate(6 12 13)"/>`,

    brush: `
        <path d="M18.9 4.5 C19.6 5.2 19.7 6.3 19 7 L12.5 13.8"/>
        <path d="M12.7 13.6 C11.5 12.9 10 13.1 9.1 14 C8.5 14.7 8.3 15.6 8.3 16.4 C8.3 17.7 7.6 18.9 6.4 19.4 C8.2 20.3 10.5 20.1 12 18.8 C13.4 17.6 13.8 15.7 13 14.2 Z"/>`,

    coin: `
        <ellipse cx="12" cy="12" rx="7.7" ry="7.5" transform="rotate(5 12 12)"/>
        <path d="M14.7 9.3 C13.9 8.5 12.7 8.2 11.7 8.6 C10.4 9.1 9.7 10.6 9.9 12.1 C10.1 13.6 11.2 14.7 12.6 14.9 C13.5 15 14.3 14.7 14.9 14.1"/>
        <path d="M8.8 11.2 L12.9 11.1 M8.8 12.9 L12.4 12.8"/>`,

    paw: `
        <path d="M12 13.4 C13.8 13.4 15.3 14.6 15.6 16.2 C15.9 17.9 14.6 19.3 12.8 19.3 L11.2 19.3 C9.4 19.3 8.1 17.9 8.4 16.2 C8.7 14.6 10.2 13.4 12 13.4 Z"/>
        <ellipse cx="7.2" cy="11.2" rx="1.3" ry="1.5" transform="rotate(-18 7.2 11.2)"/>
        <ellipse cx="10.3" cy="8.7" rx="1.4" ry="1.6" transform="rotate(-6 10.3 8.7)"/>
        <ellipse cx="13.7" cy="8.7" rx="1.4" ry="1.6" transform="rotate(6 13.7 8.7)"/>
        <ellipse cx="16.8" cy="11.2" rx="1.3" ry="1.5" transform="rotate(18 16.8 11.2)"/>`,

    flower: `
        <ellipse cx="12" cy="12" rx="1.9" ry="1.8"/>
        <ellipse cx="12" cy="6.9" rx="1.8" ry="2.5" transform="rotate(3 12 6.9)"/>
        <ellipse cx="16.9" cy="10.4" rx="1.8" ry="2.5" transform="rotate(75 16.9 10.4)"/>
        <ellipse cx="15" cy="16.1" rx="1.8" ry="2.5" transform="rotate(147 15 16.1)"/>
        <ellipse cx="9" cy="16.1" rx="1.8" ry="2.5" transform="rotate(213 9 16.1)"/>
        <ellipse cx="7.1" cy="10.4" rx="1.8" ry="2.5" transform="rotate(285 7.1 10.4)"/>`,

    mountain: `
        <path d="M3.9 18.5 L9.6 7.9 L13.4 14.7 L15.7 10.9 L20.1 18.5 Z"/>
        <path d="M8.3 10.4 L9.6 11.6 L10.9 10.3"/>`,

    chat: `
        <path d="M5 6.6 C9.6 6.2 14.4 6.2 19 6.6 C19.3 9.3 19.3 12.1 19 14.8 C16.4 15.1 13.7 15.2 11.1 15.1 L7.6 18.3 L7.7 15 C6.8 15 5.9 14.9 5 14.8 C4.7 12.1 4.7 9.3 5 6.6 Z"/>
        <path d="M8.9 10.8 L9 10.9 M11.9 10.7 L12 10.8 M14.9 10.7 L15 10.8"/>`,

    snowflake: `
        <path d="M12 4.2 L12 19.8 M5.3 8.1 L18.7 15.9 M18.7 8.1 L5.3 15.9"/>
        <path d="M10.2 6.1 L12 7.8 L13.8 6.1 M10.2 17.9 L12 16.2 L13.8 17.9"/>`,

    stairs: `
        <path d="M4.4 19.1 L4.5 15.6 L8.4 15.5 L8.4 12 L12.3 12 L12.4 8.5 L16.2 8.4 L16.3 5 L19.8 4.9"/>`,

    /* ---- UI icons ---- */

    sliders: `
        <path d="M4.5 7 L19.6 6.8 M4.4 12.1 L19.5 12 M4.5 17.2 L19.6 17"/>
        <ellipse cx="9" cy="6.9" rx="1.7" ry="1.6" fill="var(--surface, #fff)"/>
        <ellipse cx="15.2" cy="12" rx="1.7" ry="1.6" fill="var(--surface, #fff)"/>
        <ellipse cx="7.6" cy="17.1" rx="1.7" ry="1.6" fill="var(--surface, #fff)"/>`,

    plus: `<path d="M12.1 5.4 L11.9 18.6 M5.4 12.1 L18.6 11.9"/>`,

    pencil: `
        <path d="M5.3 18.7 L5.9 15.5 L15.8 5.4 C16.6 4.6 17.9 4.7 18.6 5.5 C19.3 6.2 19.3 7.4 18.6 8.2 L8.6 18.2 Z"/>
        <path d="M14.9 6.5 L17.6 9.1"/>`,

    check: `<path d="M5.2 12.8 C7 14.3 8.4 15.9 9.4 17.7 C11.7 13.2 14.9 9.2 19 6"/>`,

    play: `<path d="M9.2 6.7 C12.1 8.3 14.7 10 16.9 11.9 C14.7 13.9 12.2 15.6 9.3 17.2 C9 13.7 9 10.2 9.2 6.7 Z"/>`,

    stop: `<path d="M8.1 8.3 C10.7 8 13.3 8 15.9 8.2 C16.1 10.7 16.1 13.2 15.9 15.7 C13.3 16 10.7 16 8.2 15.8 C8 13.3 8 10.8 8.1 8.3 Z"/>`,

    x: `<path d="M7.2 7.5 C10.3 10.4 13.4 13.5 16.6 16.8 M16.9 7.2 C13.6 10.3 10.4 13.5 7.4 16.7"/>`,

    flame: `
        <path d="M12.3 3.6 C13.6 6.2 15.9 8.1 17 10.6 C18.2 13.3 17.3 16.5 15 18.3 C12.7 20.2 9.4 20 7.3 18 C5.2 16 4.9 12.8 6.4 10.4 C7 9.4 7.8 8.5 8.4 7.5 C9 9 9.1 10.1 8.7 11.6 C11 10.2 12.4 7 12.3 3.6 Z"/>
        <path d="M12.2 12.6 C13.1 13.7 13.3 15.1 12.6 16.2 C11.9 17.3 10.5 17.6 9.5 16.9"/>`,

    export: `
        <path d="M5 15.6 C5 17.1 5.2 18.5 5.6 18.9 C7.7 19.3 16.3 19.3 18.4 18.9 C18.8 18.5 19 17 19 15.5"/>
        <path d="M12 4.6 L12.1 14.1 M8.8 7.8 C9.9 6.6 11 5.6 12.1 4.5 C13.2 5.6 14.2 6.7 15.2 7.8"/>`,

    import: `
        <path d="M5 15.6 C5 17.1 5.2 18.5 5.6 18.9 C7.7 19.3 16.3 19.3 18.4 18.9 C18.8 18.5 19 17 19 15.5"/>
        <path d="M12.1 4.6 L12 14 M8.8 10.9 C9.9 12 10.9 13.1 12 14.1 C13.1 13 14.1 11.9 15.2 10.8"/>`,

    help: `
        <ellipse cx="12" cy="12" rx="8.2" ry="8" transform="rotate(4 12 12)"/>
        <path d="M9.5 9.5 C9.7 7.8 11.2 6.8 12.7 7.2 C14.1 7.5 15 8.9 14.5 10.3 C14.1 11.5 12.8 12 12.1 13 C11.9 13.4 11.9 13.8 11.9 14.3"/>
        <path d="M11.9 16.9 L12 17"/>`,

    scroll: `
        <path d="M6.8 4.6 C10.2 4.3 13.8 4.3 17.1 4.6 C17.4 9.5 17.4 14.4 17.1 19.3 C13.8 19.6 10.2 19.6 6.9 19.3 C6.6 14.4 6.6 9.5 6.8 4.6 Z"/>
        <path d="M9.4 9 L14.6 8.9 M9.4 12.1 L14.7 12 M9.4 15.2 L13 15.1"/>`,

    sprout: `
        <path d="M12 20 C12.2 16.5 12.1 13.8 11.9 11.6"/>
        <path d="M11.8 12.8 C9.3 13.2 6.9 11.9 6.1 9.6 C5.8 8.7 5.7 7.8 5.9 7 C8.9 6.7 11.5 8.8 12 11.8 C12 12.1 12 12.5 11.8 12.8 Z"/>
        <path d="M12.1 11.5 C12.3 8.5 14.7 6.2 17.7 6.1 C18.3 9.3 16.2 12.3 12.9 12.6 C12.6 12.6 12.3 12.4 12.1 12.1 Z"/>`,

    chart: `
        <path d="M4.9 19.2 C9.6 18.9 14.3 18.9 19 19.2"/>
        <path d="M7.4 16.4 L7.5 11.9 M12 16.5 L12.1 6.8 M16.6 16.4 L16.7 9.6" stroke-width="2.6"/>`,

    trophy: `
        <path d="M8.2 4.6 C10.7 4.3 13.3 4.3 15.8 4.6 C16 6.9 15.9 9.2 15.4 11.4 C14.9 13.5 13.6 14.9 12 14.9 C10.4 14.9 9.1 13.5 8.6 11.4 C8.1 9.2 8 6.9 8.2 4.6 Z"/>
        <path d="M8.3 6.2 C6.9 6.3 5.8 7.4 5.9 8.8 C6 10.2 7.3 11.1 8.8 11 M15.7 6.2 C17.1 6.3 18.2 7.4 18.1 8.8 C18 10.2 16.7 11.1 15.2 11"/>
        <path d="M12 15 L12 17.5 M9.3 19.4 C9.6 18.3 10.6 17.6 12 17.6 C13.4 17.6 14.4 18.3 14.7 19.4 C12.9 19.6 11.1 19.6 9.3 19.4 Z"/>`,

    chevL: `<path d="M14.6 5.7 C12.2 7.7 10.2 9.8 8.7 12 C10.3 14.3 12.3 16.4 14.5 18.3"/>`,

    chevR: `<path d="M9.4 5.7 C11.8 7.7 13.8 9.8 15.3 12 C13.7 14.3 11.7 16.4 9.5 18.3"/>`,

    chevU: `<path d="M5.7 14.8 C7.7 12.4 9.8 10.4 12 8.9 C14.3 10.5 16.4 12.5 18.3 14.6"/>`,

    chevD: `<path d="M5.7 9.4 C7.7 11.8 9.8 13.8 12 15.3 C14.3 13.7 16.4 11.7 18.3 9.6"/>`,

    reorder: `
        <path d="M8.2 18.8 L8 5.8 M5.2 8.7 C6.2 7.6 7.1 6.5 8 5.4 C8.9 6.5 9.8 7.6 10.7 8.7"/>
        <path d="M15.8 5.2 L16 18.2 M13.1 15.3 C14.1 16.4 15 17.5 15.9 18.6 C16.8 17.5 17.7 16.4 18.7 15.3"/>`,

    target: `
        <ellipse cx="12" cy="12" rx="8.1" ry="7.9" transform="rotate(5 12 12)"/>
        <ellipse cx="12" cy="12.1" rx="4.6" ry="4.4" transform="rotate(-7 12 12.1)"/>
        <path d="M11.9 12 L12.1 12.1"/>`,

    case: `
        <path d="M5.2 8.9 C9.7 8.5 14.3 8.5 18.8 8.9 C19.1 12 19.1 15.1 18.8 18.1 C14.3 18.5 9.8 18.5 5.3 18.2 C5 15.1 5 12 5.2 8.9 Z"/>
        <path d="M9.5 8.7 C9.4 7.6 9.6 6.5 10 6.1 C11.3 5.9 12.7 5.9 14 6.1 C14.4 6.6 14.5 7.7 14.4 8.8"/>
        <path d="M9.2 9.1 L9.3 18 M14.8 8.9 L14.7 17.9"/>`,

    grid: `
        <path d="M4.9 5.2 C6.8 5 8.6 5 10.4 5.2 C10.6 7 10.6 8.8 10.4 10.5 C8.6 10.7 6.8 10.7 5.1 10.5 C4.9 8.8 4.8 7 4.9 5.2 Z"/>
        <path d="M13.6 5.1 C15.4 4.9 17.2 4.9 19 5.1 C19.2 6.9 19.2 8.7 19 10.4 C17.3 10.6 15.5 10.6 13.8 10.5 C13.6 8.7 13.5 6.9 13.6 5.1 Z"/>
        <path d="M5 13.6 C6.8 13.4 8.6 13.4 10.3 13.6 C10.5 15.4 10.5 17.2 10.3 18.9 C8.6 19.1 6.8 19.1 5.2 18.9 C5 17.2 4.9 15.4 5 13.6 Z"/>
        <path d="M13.7 13.5 C15.5 13.3 17.3 13.3 19.1 13.5 C19.3 15.3 19.3 17.1 19.1 18.8 C17.4 19 15.6 19 13.9 18.9 C13.7 17.1 13.6 15.3 13.7 13.5 Z"/>`
};

const ICON_NAMES_HABIT = [
    'meditate', 'dumbbell', 'book', 'guitar', 'run', 'sunrise', 'books', 'moon',
    'drop', 'apple', 'bike', 'pen', 'tooth', 'broom', 'sun', 'timer',
    'heart', 'pulse', 'music', 'bed', 'pill', 'glass', 'coffee', 'phoneOff',
    'smokeOff', 'wineOff', 'leaf', 'shoe', 'waves', 'kettlebell', 'bulb', 'camera',
    'brush', 'coin', 'paw', 'flower', 'mountain', 'chat', 'snowflake', 'stairs'
];

/* Search keywords per habit icon (English + German) */
const ICON_KEYWORDS = {
    meditate: 'meditation yoga zen calm mindfulness meditieren achtsamkeit',
    dumbbell: 'workout gym strength weights lift training hantel kraft fitness',
    book: 'read reading lesen buch lernen',
    guitar: 'music instrument practice gitarre musik \u00fcben',
    run: 'running jog cardio laufen joggen rennen sport',
    sunrise: 'morning early wake dawn morgen aufstehen sonnenaufgang',
    books: 'study learn school exam studieren lernen b\u00fccher',
    moon: 'night sleep fasting evening nacht mond fasten abend',
    drop: 'water hydrate drink wasser trinken tropfen',
    apple: 'food fruit healthy eating diet essen obst gesund ern\u00e4hrung',
    bike: 'cycling bicycle ride fahrrad radfahren',
    pen: 'write journal diary schreiben tagebuch stift',
    tooth: 'teeth dental floss brush z\u00e4hne zahn putzen',
    broom: 'clean tidy chores putzen aufr\u00e4umen haushalt',
    sun: 'day light outside sonne tag draussen',
    timer: 'stopwatch time fasting track timer zeit uhr',
    heart: 'love health family herz liebe gesundheit',
    pulse: 'heartbeat cardio health fitness puls herzfrequenz',
    music: 'song listen practice note musik lied h\u00f6ren',
    bed: 'sleep rest bedtime nap schlafen bett ruhe',
    pill: 'medicine vitamin supplement tablette medikament vitamine',
    glass: 'water drink hydrate glas wasser trinken',
    coffee: 'caffeine cup tea kaffee tee koffein tasse',
    phoneOff: 'screen time no phone digital detox handy bildschirmzeit',
    smokeOff: 'quit smoking no cigarette rauchen aufh\u00f6ren zigarette nichtraucher',
    wineOff: 'no alcohol sober drink less alkohol n\u00fcchtern verzicht',
    leaf: 'nature vegan plant green natur pflanze vegan blatt',
    shoe: 'walk steps hike spazieren gehen schritte schuhe',
    waves: 'swim swimming water sea schwimmen wasser meer wellen',
    kettlebell: 'workout gym strength swing kettlebell kugelhantel training',
    bulb: 'idea learn think practice idee lernen denken gl\u00fchbirne',
    camera: 'photo photography picture foto fotografieren kamera',
    brush: 'paint art draw creative malen kunst zeichnen pinsel',
    coin: 'money save budget finance geld sparen finanzen m\u00fcnze',
    paw: 'dog pet walk cat hund gassi haustier katze pfote',
    flower: 'garden plant water nature blume garten pflanze giessen',
    mountain: 'hike climb outdoor wandern berg klettern',
    chat: 'language talk speak practice sprache sprechen reden chat',
    snowflake: 'cold shower ice winter kalt dusche eis winter',
    stairs: 'stairs steps climb treppe stufen steigen'
};

/* Emoji stored by v1.0 → icon names (data migration) */
const EMOJI_TO_ICON = {
    '🧘': 'meditate', '💪': 'dumbbell', '📖': 'book', '🎸': 'guitar',
    '🏃': 'run', '🌅': 'sunrise', '📚': 'books', '🌙': 'moon',
    '💧': 'drop', '🥗': 'apple', '🚴': 'bike', '✍️': 'pen',
    '🦷': 'tooth', '🧹': 'broom', '☀️': 'sun', '⏱️': 'timer'
};

function icon(name, extraClass) {
    const body = ICON_PATHS[name] || ICON_PATHS.sun;
    return `<svg class="hi${extraClass ? ' ' + extraClass : ''}" viewBox="0 0 24 24" fill="none" ` +
        `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ` +
        `aria-hidden="true">${body}</svg>`;
}
