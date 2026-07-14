interface Destroyable {
  destroy(): void;
}

interface TextureGenerator<TSource, TTexture> {
  generateTexture(options: { target: TSource; resolution: number }): TTexture;
}

export function bakeTexture<TSource extends Destroyable, TTexture>(
  renderer: TextureGenerator<TSource, TTexture>,
  draw: () => TSource,
  resolution: number,
): TTexture {
  const source = draw();
  const texture = renderer.generateTexture({ target: source, resolution });
  source.destroy();
  return texture;
}
