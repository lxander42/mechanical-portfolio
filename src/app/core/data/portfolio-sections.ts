import { PortfolioSection } from '../models/portfolio-section';

/**
 * Central definition of the sections that power both the navigation block and
 * the interactive 3D hotspots. Updating this list automatically keeps the UI
 * and the 3D scene in sync.
 */
export const PORTFOLIO_SECTIONS: readonly PortfolioSection[] = [
  {
    id: 'about',
    label: 'About',
    route: '/about',
    meshName: 'about',
    description: 'Overview of professional focus and key skills.'
  },
  {
    id: 'resume',
    label: 'Resume',
    route: '/resume',
    meshName: 'resume',
    description: 'Experience, education and certifications.'
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    route: '/portfolio',
    meshName: 'portfolio',
    description: 'Highlighted mechanical and software projects.'
  },
  {
    id: 'wiki',
    label: 'Wiki',
    route: '/wiki',
    meshName: 'wiki',
    description: 'Knowledge base, notes and research articles.'
  }
];
