import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

type WikiEntry = {
  title: string;
  description: string;
  file: string;
};

type WikiDocument = {
  entry: WikiEntry;
  content: SafeHtml;
};

@Component({
  selector: 'app-wiki',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wiki.component.html',
  styleUrls: ['./wiki.component.css']
})
export class WikiComponent implements OnInit {
  readonly entries = signal<WikiEntry[]>([]);
  readonly activeDoc = signal<WikiDocument | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {
    const renderer = new marked.Renderer();
    renderer.link = (href, title, text) => {
      if (!href) {
        return text;
      }

      const isRelative = !/^(https?:)?\/\//.test(href) && !href.startsWith('#');
      const escapedText = text ?? href;
      const titleAttr = title ? ` title="${title}"` : '';

      if (isRelative) {
        const safeHref = href.replace(/"/g, '&quot;');
        return `<a href="#" data-doc="${safeHref}"${titleAttr}>${escapedText}</a>`;
      }

      return `<a href="${href}" target="_blank" rel="noopener"${titleAttr}>${escapedText}</a>`;
    };

    marked.setOptions({ renderer, breaks: true });
  }

  ngOnInit(): void {
    this.fetchManifest();
  }

  fetchManifest(): void {
    this.loading.set(true);
    this.http.get<WikiEntry[]>('docs/manifest.json').subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
        this.error.set(null);
        if (entries.length > 0) {
          this.loadDoc(entries[0]);
        }
      },
      error: () => {
        this.error.set('Unable to load wiki manifest.');
        this.loading.set(false);
      }
    });
  }

  loadDoc(entry: WikiEntry): void {
    this.loading.set(true);
    this.error.set(null);
    this.http
      .get(`docs/${entry.file}`, { responseType: 'text' })
      .subscribe({
        next: (markdown) => {
          const html = marked.parse(markdown) as string;
          this.activeDoc.set({ entry, content: this.sanitizer.bypassSecurityTrustHtml(html) });
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Unable to load document.');
          this.loading.set(false);
        }
      });
  }

  handleContentClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest('a[data-doc]');
    if (!target) {
      return;
    }

    event.preventDefault();
    const file = target.getAttribute('data-doc');
    if (!file) {
      return;
    }

    const entry = this.entries().find((item) => item.file === file);
    if (entry) {
      this.loadDoc(entry);
    }
  }
}
