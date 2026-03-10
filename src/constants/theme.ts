export type AppTheme = {
  ink: string;
  paper: string;
  paperStrong: string;
  sand: string;
  teal: string;
  tealSoft: string;
  amber: string;
  amberSoft: string;
  coral: string;
  coralSoft: string;
  slate: string;
  sky: string;
  mint: string;
  shadow: string;
  night: string;
  glass: string;
  glassStrong: string;
  glassEdge: string;
  glassEdgeStrong: string;
  glowBlue: string;
  glowPink: string;
  glowMint: string;
  buttonText: string;
  backgroundTop: string;
  backgroundMid: string;
  backgroundBottom: string;
  statusTrack: string;
  inputFill: string;
  inputEdge: string;
  stage: {
    pending: string;
    active: string;
    completed: string;
    blocked: string;
  };
  priority: {
    Alta: string;
    Media: string;
    Baja: string;
  };
};

export const darkTheme: AppTheme = {
  ink: '#f3f7ff',
  paper: '#050816',
  paperStrong: 'rgba(14, 23, 42, 0.78)',
  sand: 'rgba(255, 255, 255, 0.14)',
  teal: '#5ce1ff',
  tealSoft: 'rgba(92, 225, 255, 0.18)',
  amber: '#ff9a76',
  amberSoft: 'rgba(255, 154, 118, 0.18)',
  coral: '#ff6b91',
  coralSoft: 'rgba(255, 107, 145, 0.18)',
  slate: '#9ab0d4',
  sky: 'rgba(77, 196, 255, 0.18)',
  mint: 'rgba(123, 255, 182, 0.18)',
  shadow: 'rgba(2, 8, 23, 0.45)',
  night: '#081120',
  glass: 'rgba(11, 18, 35, 0.58)',
  glassStrong: 'rgba(16, 27, 50, 0.82)',
  glassEdge: 'rgba(255, 255, 255, 0.16)',
  glassEdgeStrong: 'rgba(120, 230, 255, 0.28)',
  glowBlue: 'rgba(92, 225, 255, 0.32)',
  glowPink: 'rgba(255, 107, 145, 0.24)',
  glowMint: 'rgba(123, 255, 182, 0.18)',
  buttonText: '#071221',
  backgroundTop: '#06101f',
  backgroundMid: '#0a1831',
  backgroundBottom: '#123052',
  statusTrack: 'rgba(255,255,255,0.18)',
  inputFill: 'rgba(255,255,255,0.06)',
  inputEdge: 'rgba(255,255,255,0.12)',
  stage: {
    pending: '#8193b2',
    active: '#5ce1ff',
    completed: '#7bffb6',
    blocked: '#ff7aa5',
  },
  priority: {
    Alta: '#ff6b91',
    Media: '#ffb36c',
    Baja: '#7bffb6',
  },
};

export const lightTheme: AppTheme = {
  ink: '#102038',
  paper: '#eef5ff',
  paperStrong: 'rgba(255, 255, 255, 0.84)',
  sand: 'rgba(16, 32, 56, 0.12)',
  teal: '#127ea2',
  tealSoft: 'rgba(18, 126, 162, 0.14)',
  amber: '#d47b32',
  amberSoft: 'rgba(212, 123, 50, 0.14)',
  coral: '#d54873',
  coralSoft: 'rgba(213, 72, 115, 0.14)',
  slate: '#58708d',
  sky: 'rgba(18, 126, 162, 0.1)',
  mint: 'rgba(34, 173, 124, 0.12)',
  shadow: 'rgba(65, 88, 128, 0.18)',
  night: '#dce8f8',
  glass: 'rgba(255, 255, 255, 0.64)',
  glassStrong: 'rgba(255, 255, 255, 0.92)',
  glassEdge: 'rgba(16, 32, 56, 0.1)',
  glassEdgeStrong: 'rgba(18, 126, 162, 0.24)',
  glowBlue: 'rgba(18, 126, 162, 0.18)',
  glowPink: 'rgba(213, 72, 115, 0.14)',
  glowMint: 'rgba(34, 173, 124, 0.12)',
  buttonText: '#f4fbff',
  backgroundTop: '#f6fbff',
  backgroundMid: '#e7f1ff',
  backgroundBottom: '#d7e6ff',
  statusTrack: 'rgba(16,32,56,0.14)',
  inputFill: 'rgba(255,255,255,0.82)',
  inputEdge: 'rgba(16,32,56,0.1)',
  stage: {
    pending: '#94a3b8',
    active: '#127ea2',
    completed: '#229d78',
    blocked: '#d54873',
  },
  priority: {
    Alta: '#d54873',
    Media: '#d47b32',
    Baja: '#229d78',
  },
};

export const roleLabels = {
  comercial: 'Comercial',
  administracion: 'Administracion',
  diseno: 'Diseno',
  carpinteria: 'Carpinteria',
  tapiceria: 'Tapiceria',
  calidad: 'Calidad',
  despacho: 'Despacho',
} as const;

export const tabs = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'solicitudes', label: 'Solicitudes' },
  { key: 'administracion', label: 'Administracion' },
  { key: 'flujo', label: 'Flujo' },
  { key: 'notificaciones', label: 'Notificaciones' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'equipo', label: 'Equipo' },
  { key: 'mejoras', label: '250 mejoras' },
] as const;
