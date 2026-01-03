/**
 * Rich Text Processing Utility
 * Converts plain text to rich content with:
 * - YouTube embeds
 * - Clickable hyperlinks
 * - Line breaks preserved
 */

export interface RichTextOptions {
  allowYouTube?: boolean
  allowHyperlinks?: boolean
  openLinksInNewTab?: boolean
}

const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g
const URL_REGEX = /(https?:\/\/[^\s]+)/g
const QUOTE_REGEX = />>(\d+)/g

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

/**
 * Process text into rich content with embeds and links
 */
export function processRichText(
  text: string,
  options: RichTextOptions = {}
): React.ReactNode {
  const {
    allowYouTube = true,
    allowHyperlinks = true,
    openLinksInNewTab = true
  } = options

  // Split text into lines to preserve line breaks
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, lineIndex) => {
    // Check if line is a greentext (starts with > but not >>)
    const isGreentext = line.trim().startsWith('>') && !line.trim().startsWith('>>')
    
    const lineElements: React.ReactNode[] = []
    let lastIndex = 0

    // Helper to push text segment
    const pushText = (text: string, key: string) => {
      if (!text) return
      lineElements.push(
        <span 
          key={key} 
          className={isGreentext ? "text-green-600 font-mono" : undefined}
        >
          {text}
        </span>
      )
    }

    // First, find and replace YouTube URLs
    if (allowYouTube) {
      const youtubeMatches = Array.from(line.matchAll(YOUTUBE_REGEX))
      
      youtubeMatches.forEach((match, matchIndex) => {
        const [fullMatch, videoId] = match
        const startIndex = match.index!

        // Add text before the YouTube link
        if (startIndex > lastIndex) {
          pushText(line.substring(lastIndex, startIndex), `text-${lineIndex}-${matchIndex}-before`)
        }

        // Add YouTube embed
        lineElements.push(
          <div key={`youtube-${lineIndex}-${matchIndex}`} className="my-4">
            <div className="aspect-video border-2 border-black">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        )

        lastIndex = startIndex + fullMatch.length
      })
    }

    // Get remaining text after YouTube embeds
    let remainingText = line.substring(lastIndex)
    
    // Process URLs and Quotes in remaining text
    // We need to handle them in order of appearance
    
    // Combine regexes or handle sequentially? 
    // Let's handle URLs first for simplicity, then process Quotes in the text parts
    
    const parts: { type: 'text' | 'url' | 'quote', content: string, id?: string }[] = []
    
    if (allowHyperlinks && remainingText) {
       const urlMatches = Array.from(remainingText.matchAll(URL_REGEX))
       let urlCursor = 0
       
       urlMatches.forEach((match) => {
         const [url] = match
         const index = match.index!
         
         if (allowYouTube && extractYouTubeId(url)) return
         
         // Text before URL
         if (index > urlCursor) {
           parts.push({ type: 'text', content: remainingText.substring(urlCursor, index) })
         }
         
         parts.push({ type: 'url', content: url })
         urlCursor = index + url.length
       })
       
       if (urlCursor < remainingText.length) {
         parts.push({ type: 'text', content: remainingText.substring(urlCursor) })
       }
       
       if (urlMatches.length === 0) {
         parts.push({ type: 'text', content: remainingText })
       }
    } else {
      parts.push({ type: 'text', content: remainingText })
    }

    // Now process quotes in 'text' parts
    const finalParts: React.ReactNode[] = []
    
    parts.forEach((part, partIndex) => {
      if (part.type === 'url') {
        finalParts.push(
          <a
            key={`link-${lineIndex}-${partIndex}`}
            href={part.content}
            target={openLinksInNewTab ? '_blank' : undefined}
            rel={openLinksInNewTab ? 'noopener noreferrer' : undefined}
            className="underline hover:no-underline font-bold text-blue-400"
          >
            {part.content}
          </a>
        )
      } else {
        // Process quotes in text
        const quoteMatches = Array.from(part.content.matchAll(QUOTE_REGEX))
        let quoteCursor = 0
        
        quoteMatches.forEach((match, matchIndex) => {
          const [fullMatch, postId] = match
          const index = match.index!
          
          if (index > quoteCursor) {
            pushText(part.content.substring(quoteCursor, index), `text-${lineIndex}-${partIndex}-${matchIndex}`)
          }
          
          finalParts.push(
            <a
              key={`quote-${lineIndex}-${partIndex}-${matchIndex}`}
              href={`#p${postId}`}
              data-post-id={postId}
              className="quotelink text-red-400 hover:underline cursor-pointer font-bold"
            >
              {fullMatch}
            </a>
          )
          
          quoteCursor = index + fullMatch.length
        })
        
        if (quoteCursor < part.content.length) {
          pushText(part.content.substring(quoteCursor), `text-${lineIndex}-${partIndex}-end`)
        }
        
        if (quoteMatches.length === 0) {
          pushText(part.content, `text-${lineIndex}-${partIndex}`)
        }
      }
    })
    
    lineElements.push(...finalParts)

    // Add line break if not the last line and there are elements
    if (lineElements.length > 0) {
      elements.push(
        <div key={`line-${lineIndex}`}>
          {lineElements}
        </div>
      )
    } else if (line === '') {
      // Empty line - add a line break
      elements.push(<br key={`br-${lineIndex}`} />)
    }
  })

  return <>{elements}</>
}

/**
 * Get available font options for blog theming
 */
export const BLOG_FONT_OPTIONS = [
  // MONOSPACE FONTS
  { value: 'mono', label: 'Courier (Default)', family: "'Courier New', Courier, monospace" },
  { value: 'courier-prime', label: 'Courier Prime', family: "'Courier Prime', monospace" },
  { value: 'fira-code', label: 'Fira Code', family: "'Fira Code', monospace" },
  { value: 'ibm-plex', label: 'IBM Plex Mono', family: "'IBM Plex Mono', monospace" },
  { value: 'jetbrains', label: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
  { value: 'source-code', label: 'Source Code Pro', family: "'Source Code Pro', monospace" },
  { value: 'space-mono', label: 'Space Mono', family: "'Space Mono', monospace" },
  { value: 'vt323', label: 'VT323 (Retro)', family: "'VT323', monospace" },
  { value: 'inconsolata', label: 'Inconsolata', family: "'Inconsolata', monospace" },
  { value: 'roboto-mono', label: 'Roboto Mono', family: "'Roboto Mono', monospace" },
  { value: 'proggy', label: 'Proggy Vector', family: "'Proggy Vector', monospace" },
  { value: 'hack', label: 'Hack', family: "'Hack', monospace" },
  { value: 'overpass-mono', label: 'Overpass Mono', family: "'Overpass Mono', monospace" },
  { value: 'pt-mono', label: 'PT Mono', family: "'PT Mono', monospace" },
  { value: 'andale-mono', label: 'Andale Mono', family: "'Andale Mono', monospace" },
  
  // SANS-SERIF FONTS
  { value: 'noto-sans', label: 'Noto Sans', family: "'Noto Sans', sans-serif" },
  { value: 'roboto', label: 'Roboto', family: "'Roboto', sans-serif" },
  { value: 'open-sans', label: 'Open Sans', family: "'Open Sans', sans-serif" },
  { value: 'inter', label: 'Inter', family: "'Inter', sans-serif" },
  { value: 'poppins', label: 'Poppins', family: "'Poppins', sans-serif" },
  { value: 'ubuntu', label: 'Ubuntu', family: "'Ubuntu', sans-serif" },
  { value: 'montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif" },
  { value: 'work-sans', label: 'Work Sans', family: "'Work Sans', sans-serif" },
  { value: 'raleway', label: 'Raleway', family: "'Raleway', sans-serif" },
  { value: 'oxygen', label: 'Oxygen', family: "'Oxygen', sans-serif" },
  { value: 'source-sans', label: 'Source Sans Pro', family: "'Source Sans Pro', sans-serif" },
  { value: 'lato', label: 'Lato', family: "'Lato', sans-serif" },
  { value: 'quicksand', label: 'Quicksand', family: "'Quicksand', sans-serif" },
  { value: 'dosis', label: 'Dosis', family: "'Dosis', sans-serif" },
  { value: 'muli', label: 'Muli', family: "'Muli', sans-serif" },
  { value: 'nunito', label: 'Nunito', family: "'Nunito', sans-serif" },
  { value: 'varela-round', label: 'Varela Round', family: "'Varela Round', sans-serif" },
  
  // SERIF FONTS
  { value: 'roboto-slab', label: 'Roboto Slab', family: "'Roboto Slab', serif" },
  { value: 'crimson', label: 'Crimson Text', family: "'Crimson Text', serif" },
  { value: 'lora', label: 'Lora', family: "'Lora', serif" },
  { value: 'merriweather', label: 'Merriweather', family: "'Merriweather', serif" },
  { value: 'playfair', label: 'Playfair Display', family: "'Playfair Display', serif" },
  { value: 'abril', label: 'Abril Fatface', family: "'Abril Fatface', serif" },
  { value: 'bodoni', label: 'Bodoni Moda', family: "'Bodoni Moda', serif" },
  { value: 'cinzel', label: 'Cinzel', family: "'Cinzel', serif" },
  { value: 'cormorant', label: 'Cormorant Garamond', family: "'Cormorant Garamond', serif" },
  { value: 'eb-garamond', label: 'EB Garamond', family: "'EB Garamond', serif" },
  { value: 'gentium', label: 'Gentium Book Basic', family: "'Gentium Book Basic', serif" },
  { value: 'libre-baskerville', label: 'Libre Baskerville', family: "'Libre Baskerville', serif" },
  { value: 'noto-serif', label: 'Noto Serif', family: "'Noto Serif', serif" },
  { value: 'pt-serif', label: 'PT Serif', family: "'PT Serif', serif" },
  { value: 'source-serif', label: 'Source Serif Pro', family: "'Source Serif Pro', serif" },
  { value: 'spectral', label: 'Spectral', family: "'Spectral', serif" },
  
  // DISPLAY / DECORATIVE FONTS
  { value: 'comic', label: 'Comic Neue', family: "'Comic Neue', cursive" },
  { value: 'pacifico', label: 'Pacifico', family: "'Pacifico', cursive" },
  { value: 'righteous', label: 'Righteous', family: "'Righteous', display" },
  { value: 'fredoka-one', label: 'Fredoka One', family: "'Fredoka One', sans-serif" },
  { value: 'russo-one', label: 'Russo One', family: "'Russo One', sans-serif" },
  { value: 'permanent-marker', label: 'Permanent Marker', family: "'Permanent Marker', cursive" },
  { value: 'bangers', label: 'Bangers', family: "'Bangers', cursive" },
  { value: 'indie-flower', label: 'Indie Flower', family: "'Indie Flower', cursive" },
  { value: 'architects-daughter', label: 'Architects Daughter', family: "'Architects Daughter', cursive" },
  { value: 'amatic-sc', label: 'Amatic SC', family: "'Amatic SC', cursive" },
  { value: 'caveat', label: 'Caveat', family: "'Caveat', cursive" },
  { value: 'fredoka', label: 'Fredoka', family: "'Fredoka', sans-serif" },
  { value: 'karla', label: 'Karla', family: "'Karla', sans-serif" },
  { value: 'press-start', label: 'Press Start 2P', family: "'Press Start 2P', cursive" },
  { value: 'viga', label: 'Viga', family: "'Viga', sans-serif" }
] as const

export function getFontFamily(fontValue: string): string {
  const font = BLOG_FONT_OPTIONS.find(f => f.value === fontValue)
  return font?.family || "'Courier New', Courier, monospace"
}