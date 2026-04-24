export interface Cave {
  id: number;
  name: string;
  region: string;
  type: string;
  depth_m: number;
  description: string | null;
  utm_x: number;
  utm_y: number;
  image_ext: string | null;
}
