export type OrbState = 'working' | 'searching' | 'solving' | 'listening' | 'connecting' | 'weaving' | 'composing' | 'breathing' | 'shaping';

export type OrbProps = {
  state?: OrbState;
  /** 64 for avatar-scale, 20 for inline. */
  size?: 20 | 64;
  paused?: boolean;
  label?: string;
};
