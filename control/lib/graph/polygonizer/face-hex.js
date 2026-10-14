/**
 * A face's colour as every layered reader takes it: its group's palette colour, else its part's own tint, else the
 * neutral grey. One lookup for the static solid, the shade, the rig pack and the creature's silhouette, so the moving
 * figure and the still one never disagree on a colour again (the rig once lost its palette this way).
 */
export const FACE_FALLBACK = '#8a8f96';
export const faceHex = (palette, group, part) => (palette && palette[group]) || part?.tint || FACE_FALLBACK;
