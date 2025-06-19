export type SearchMatch = {
    match: string;
    offset: number;
}

export type ResultNote = {
    score: number;
    ref: string;
    basename: string;
    content: string;
    foundWords: string[];
    matches: SearchMatch[];

    matchesName: SearchMatch[];
    excerpt: string;
}