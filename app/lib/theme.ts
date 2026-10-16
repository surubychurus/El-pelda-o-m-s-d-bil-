export const colors = {
  bg: "#07080d",
  panel: "rgba(20,22,34,0.72)",
  border: "rgba(255,255,255,0.09)",
  text: "#f2f4f8",
  muted: "#8b93a7",
  hunter: "#ff2e4d",
  hider: "#38e8ff",
  danger: "#ff6b6b",
};

export const glow = (color: string, radius = 18) => ({
  shadowColor: color,
  shadowOpacity: 0.7,
  shadowRadius: radius,
  shadowOffset: { width: 0, height: 0 },
  elevation: 12,
});

// Brillo de texto (en Text hay que usar textShadow, no shadow)
export const textGlow = (color: string, radius = 18) => ({
  textShadowColor: color,
  textShadowRadius: radius,
  textShadowOffset: { width: 0, height: 0 },
});
