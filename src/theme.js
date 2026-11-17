// ------------------------------------------------------------------
// Ant Design theme — "Agriculture Green" light theme for AgroPoint POS.
// Centralised design tokens so the whole app shares one visual system.
// ------------------------------------------------------------------

// Brand palette
export const brand = {
  primary: '#1F9254', // fresh agriculture green
  primaryHover: '#249a5a',
  primaryActive: '#177544',
  siderTop: '#0F5132', // deep emerald (sidebar gradient top)
  siderBottom: '#0B3D26', // deep emerald (sidebar gradient bottom)
  mint: '#E8F5EC', // soft mint surface
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',
  bg: '#F4F7F5', // page background (subtle green-gray)
  text: '#1B2A22',
  muted: '#6B7A72',
  border: '#E3E9E5',
}

// Shared "elegant emerald" backdrops for the sidebar and the auth screen.
// Softer, lighter and more dimensional than a flat deep green — a diagonal
// gradient with a subtle lift up top so the surface reads as premium, not heavy.
export const siderGradient =
  'linear-gradient(165deg, #1C7A4E 0%, #12583A 52%, #0C3D28 100%)'

export const loginGradient =
  `radial-gradient(1100px 560px at 15% -10%, rgba(60,200,130,0.22), transparent 60%),
   radial-gradient(900px 520px at 105% 115%, rgba(12,61,40,0.55), transparent 55%),
   linear-gradient(160deg, #1A6E46 0%, #124E33 55%, #0B3826 100%)`

const theme = {
  token: {
    colorPrimary: brand.primary,
    colorInfo: brand.primary,
    colorSuccess: brand.success,
    colorError: brand.error,
    colorWarning: brand.warning,
    colorTextBase: brand.text,
    colorBgLayout: brand.bg,
    borderRadius: 8,
    borderRadiusLG: 14,
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    wireframe: false,
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      bodyBg: brand.bg,
      headerHeight: 64,
      headerPadding: '0 24px',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkItemColor: 'rgba(255,255,255,0.72)',
      darkItemHoverColor: '#ffffff',
      darkItemHoverBg: 'rgba(255,255,255,0.10)',
      darkItemSelectedBg: brand.primary,
      darkItemSelectedColor: '#ffffff',
      itemHeight: 46,
      itemMarginInline: 10,
      itemBorderRadius: 10,
      iconSize: 17,
    },
    Card: {
      borderRadiusLG: 14,
      boxShadowTertiary: '0 1px 2px rgba(16,40,28,0.04)',
      headerFontSize: 16,
    },
    Button: {
      controlHeight: 38,
      controlHeightLG: 44,
      fontWeight: 600,
      primaryShadow: '0 2px 8px rgba(31,146,84,0.25)',
      borderRadius: 8,
    },
    Input: { controlHeight: 38, borderRadius: 8 },
    InputNumber: { controlHeight: 38, borderRadius: 8 },
    Select: { controlHeight: 38, borderRadius: 8 },
    Table: {
      headerBg: '#F3F7F4',
      headerColor: '#41524A',
      headerSplitColor: 'transparent',
      borderColor: brand.border,
      rowHoverBg: brand.mint,
      cellPaddingBlock: 12,
    },
    Statistic: { titleFontSize: 13 },
    Segmented: {
      itemSelectedBg: brand.primary,
      itemSelectedColor: '#ffffff',
      trackBg: '#EBF1ED',
      borderRadius: 8,
    },
    Modal: { borderRadiusLG: 16, titleFontSize: 18 },
    Tag: { borderRadiusSM: 6 },
    Tabs: { titleFontSize: 15, horizontalItemGutter: 28 },
  },
}

export default theme
