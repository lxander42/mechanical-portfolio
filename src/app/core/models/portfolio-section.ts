export interface PortfolioSection {
  /** Unique identifier, typically matches the Angular route name (e.g. `about`). */
  id: string;
  /** Display label used in navigation menus. */
  label: string;
  /** Router link that is triggered when a section is activated. */
  route: string;
  /**
   * Optional mesh or node name used to bind a glTF object to this section.
   * When omitted the `id` is used as the fallback.
   */
  meshName?: string;
  /**
   * Short helper text that can be shown in navigation or documentation.
   */
  description?: string;
}
