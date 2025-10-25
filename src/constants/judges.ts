export interface JudgeIconOption {
  id: string;
  label: string;
  emoji: string;
}

export const JUDGE_ICON_OPTIONS: JudgeIconOption[] = [
  { id: 'ghost', label: 'Ghost', emoji: '👻' },
  { id: 'pumpkin', label: 'Pumpkin', emoji: '🎃' },
  { id: 'skull', label: 'Skull', emoji: '💀' },
  { id: 'bat', label: 'Bat', emoji: '🦇' },
  { id: 'spider', label: 'Spider', emoji: '🕷️' },
  { id: 'moon', label: 'Moon', emoji: '🌙' },
  { id: 'star', label: 'Star', emoji: '⭐' },
  { id: 'planet', label: 'Planet', emoji: '🪐' },
  { id: 'ufo', label: 'UFO', emoji: '🛸' },
  { id: 'witch', label: 'Witch Hat', emoji: '🧙' },
];

export const JUDGE_ICON_MAP = Object.fromEntries(
  JUDGE_ICON_OPTIONS.map((icon) => [icon.id, icon])
);
