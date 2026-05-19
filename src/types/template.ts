export interface TemplateBackground {
  type: "solid" | "gradient";
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
}

export interface TemplateElement {
  id: string;
  type: "text" | "qr" | "image" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  textAlign?: "left" | "center" | "right";
  shape?: "rect" | "circle" | "roundedRect";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
  imageUrl?: string;
  qrColor?: string;
  qrBgColor?: string;
}

export interface TemplateLayout {
  width: number;
  height: number;
  background: TemplateBackground;
  elements: TemplateElement[];
}

export interface TemplateData {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  layout: TemplateLayout;
  isPublic: boolean;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}
