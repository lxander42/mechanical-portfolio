# Mechanical Portfolio

This project is a **personal portfolio** developed with the MEAN stack (MongoDB, Express, Angular, and Node.js) to showcase my work as a Mechanical Engineer. The portfolio design is inspired by **ASME standard mechanical drawings**, featuring a clean, grid-like layout with monochromatic colors to achieve a professional, blueprint-style aesthetic. The site is deployed on Vercel and includes four main sections: **About, Resume, Portfolio, and Wiki**.

## Project Overview

- **Deployed Website**: [Mechanical Portfolio on Vercel](https://mechanical-portfolio.vercel.app/about)
- **Angular CLI Version**: 18.2.10
- **Sections**: About, Resume, Portfolio, Wiki
- **Purpose**: A professional online portfolio, designed to mimic the aesthetics of an engineering drawing.

## Project Structure and Design

The layout (app.component.html) is designed with elements reminiscent of engineering drawings:

- **Grid Layout with Borders**: Thin and thick borders create a structured, compartmentalized look.
- **Markers and Coordinates**: Vertical and horizontal markers with labeled letters and numbers enhance the blueprint appearance.
- **Interactive 3D Model**: A dynamic 3D model in three-model.component.html serves as a central navigation feature.
    - **Hover to Explode**: Upon mouse hover, the model separates into distinct parts.
    - **Clickable Parts**: Users can click on individual model parts to navigate directly to corresponding sections: About, Resume, Portfolio, and Wiki.
- **Navigation Block**: A "Navigation" box styled like an engineering title block contains additional links to all sections.

## Getting Started

### Prerequisites

- **Node.js**: Version 18.x or newer
- **Angular CLI**: Version 18.2.10
- **MongoDB**: Optional, for potential future database features

### Installation

1. Clone the Repository: `git clone https://github.com/lxander42/mechanical-portfolio.git`
2. Navigate to the project folder: `cd mechanical-portfolio`
3. Install dependencies: `npm install`
4. Run the development server: `ng serve`
5. This will start the application on `http://localhost:4200`

## File Overview

- **app.component.html**: Contains the main layout with ASME-inspired borders, markers, and the navigation box.
- **three-model.component.html**: Houses the interactive 3D model display container with hover and click events.
- **app.component.ts** and **three-model.component.ts**: Include TypeScript logic for rendering and controlling the 3D model's hover and click interactivity.

## Features

- **ASME Blueprint Style**: Utilizes CSS and Angular components to achieve a blueprint-like, engineering-drawing style.
- **Responsive Design**: Markers and layout adjust for both desktop and mobile views.
- **Interactive 3D Model**: Hovering on the 3D model causes an "exploded view," separating the model into clickable parts, each linked to a section of the portfolio.

## Future Enhancements

- **Database Integration**: MongoDB setup to store portfolio project data.
- **Dark Mode Toggle**: An option for switching between light and dark themes.
- **3D Model Animations**: Additional animations to further enhance the model’s interactivity.

## Prompt for Feature additions

_I am working on an Angular project for my Mechanical Portfolio. This portfolio is a MEAN stack project inspired by ASME standard mechanical drawings, featuring a clean, monochromatic design with a grid layout. It includes four sections (About, Resume, Portfolio, and Wiki) and an interactive 3D model that separates into parts on hover, with each part clickable to navigate to different sections. The Angular project uses standalone components with no `app.module.ts`._

_I would like assistance with [adding a feature / fixing a bug]._

> **Feature / Bug Description**: [Describe your desired feature or bug in detail]

_To assist with choosing the files for upload, here’s the file structure of my latest project:_

```plaintext 
[Insert exported project file structure here]
```

_Based on the structure, please let me know which files you need to review to help me implement the feature or fix the bug._

## Instructions for Exporting file structure
**For Windows:**

```bash
tree /F /A > project-structure.txt
```

Here, `/F` lists all files, and `/A` uses ASCII characters for a cleaner look.
