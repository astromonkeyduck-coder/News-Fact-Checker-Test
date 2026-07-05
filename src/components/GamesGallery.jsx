import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import './games-gallery.css';

// Gallery Context for shared state
const GalleryContext = createContext();

export const useGallery = () => {
  const context = useContext(GalleryContext);
  if (!context) {
    throw new Error('useGallery must be used within GalleryProvider');
  }
  return context;
};

// Gallery Provider
const GalleryProvider = ({ children, games }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [openId, setOpenId] = useState(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);

  useEffect(() => {
    // Load recently played from localStorage
    const stored = localStorage.getItem('games-recently-played');
    if (stored) {
      try {
        setRecentlyPlayed(JSON.parse(stored));
      } catch (e) {
        console.warn('Failed to parse recently played games', e);
      }
    }
  }, []);

  const addToRecentlyPlayed = useCallback((game) => {
    setRecentlyPlayed((prev) => {
      const filtered = prev.filter((g) => g.id !== game.id);
      const updated = [game, ...filtered].slice(0, 10); // Keep last 10
      localStorage.setItem('games-recently-played', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const [gamesList, setGamesList] = useState(games || []);

  const value = {
    games: gamesList,
    setGames: setGamesList,
    query,
    setQuery,
    category,
    setCategory,
    openId,
    setOpenId,
    recentlyPlayed,
    addToRecentlyPlayed,
  };

  return <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>;
};

// SearchBox Component
const SearchBox = () => {
  const { query, setQuery } = useGallery();
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyPress = (e) => {
      // K to focus search, / to open search
      if ((e.key === 'k' || e.key === 'K' || e.key === '/') && !e.target.matches('input, textarea')) {
        if (e.key === '/' && e.target.tagName !== 'INPUT') {
          e.preventDefault();
        }
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="games-search-box">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search games... (Press K or /)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="games-search-input"
        aria-label="Search games"
      />
      {query && (
        <button
          onClick={() => setQuery('')}
          className="games-search-clear"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
};

// CategoryPicker Component
const CategoryPicker = () => {
  const { games, category, setCategory } = useGallery();

  const categories = React.useMemo(() => {
    const cats = new Set(['All']);
    games.forEach((game) => {
      if (game.category) cats.add(game.category);
    });
    return Array.from(cats).sort();
  }, [games]);

  return (
    <div className="games-category-picker" role="tablist" aria-label="Game categories">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => setCategory(cat)}
          className={`games-category-btn ${category === cat ? 'active' : ''}`}
          role="tab"
          aria-selected={category === cat}
          aria-controls="games-grid"
        >
          {cat}
        </button>
      ))}
    </div>
  );
};

// GameCard Component
const GameCard = ({ game }) => {
  const { setOpenId, addToRecentlyPlayed } = useGallery();

  const handlePlay = () => {
    if (!game.approved) {
      alert('This game is pending approval and cannot be played yet.');
      console.warn('Attempted to play unapproved game:', game.id);
      return;
    }

    // Validate URL
    if (!game.src || game.src.trim() === '') {
      alert('This game is not available.');
      return;
    }

    setOpenId(game.id);
    addToRecentlyPlayed(game);

    // Analytics event (if analytics endpoint exists)
    if (typeof window !== 'undefined' && window.analytics) {
      try {
        window.analytics.track('game_play', {
          game_id: game.id,
          game_title: game.title,
          game_category: game.category,
        });
      } catch (e) {
        console.warn('Analytics tracking failed', e);
      }
    }
  };

  return (
    <div className="games-card" role="article" aria-label={`Game: ${game.title}`}>
      <div className="games-card-thumbnail">
        {game.thumb ? (
          <img
            src={game.thumb}
            alt={`${game.title} thumbnail`}
            loading="lazy"
            className="games-card-img"
            onError={(e) => {
              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="225"%3E%3Crect fill="%23333" width="400" height="225"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="18"%3ENo Image%3C/text%3E%3C/svg%3E';
            }}
          />
        ) : (
          <div className="games-card-placeholder">No Image</div>
        )}
        <div className="games-card-overlay">
          <button
            onClick={handlePlay}
            className="games-card-play-btn"
            aria-label={`Play ${game.title}`}
          >
            ▶ Play
          </button>
        </div>
      </div>
      <div className="games-card-content">
        <div className="games-card-header">
          <h3 className="games-card-title">{game.title}</h3>
          {game.category && (
            <span className="games-card-category" aria-label={`Category: ${game.category}`}>
              {game.category}
            </span>
          )}
        </div>
        {game.description && (
          <p className="games-card-description">{game.description}</p>
        )}
        {!game.approved && (
          <div className="games-card-warning" role="alert" aria-live="polite">
            ⚠️ Pending Approval
          </div>
        )}
      </div>
    </div>
  );
};

// ModalPlayer Component (dynamically imported)
const ModalPlayer = React.lazy(() => {
  return new Promise((resolve) => {
    // Simulate dynamic import for code splitting
    resolve({
      default: ({ game, onClose }) => {
        const modalRef = useRef(null);
        const iframeRef = useRef(null);
        const closeButtonRef = useRef(null);

        useEffect(() => {
          // Focus trap
          const handleTab = (e) => {
            if (e.key !== 'Tab') return;
            const focusableElements = modalRef.current?.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (!focusableElements || focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
              if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
              }
            } else {
              if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }
          };

          const handleEscape = (e) => {
            if (e.key === 'Escape') {
              onClose();
            }
          };

          // Focus close button on open
          closeButtonRef.current?.focus();

          document.addEventListener('keydown', handleEscape);
          document.addEventListener('keydown', handleTab);
          document.body.style.overflow = 'hidden';

          return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('keydown', handleTab);
            document.body.style.overflow = '';
          };
        }, []);

        // Validate and prepare iframe src
        const getIframeSrc = () => {
          if (!game.src) return null;

          // If it's a relative path (starts with /), it's self-hosted
          if (game.src.startsWith('/')) {
            return game.src;
          }

          // If it's an external URL, check if it's approved
          if (game.src.startsWith('http://') || game.src.startsWith('https://')) {
            if (!game.approved) {
              console.warn('External embed not approved:', game.src);
              return null;
            }
            return game.src;
          }

          return game.src;
        };

        const iframeSrc = getIframeSrc();

        if (!iframeSrc) {
          return (
            <div className="games-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
              <div className="games-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
                <div className="games-modal-header">
                  <h2 id="modal-title">{game.title}</h2>
                  <button
                    ref={closeButtonRef}
                    onClick={onClose}
                    className="games-modal-close"
                    aria-label="Close modal"
                  >
                    ×
                  </button>
                </div>
                <div className="games-modal-content">
                  <p>This game is not available or pending approval.</p>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div
            className="games-modal-overlay"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="games-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
              <div className="games-modal-header">
                <h2 id="modal-title">{game.title}</h2>
                <button
                  ref={closeButtonRef}
                  onClick={onClose}
                  className="games-modal-close"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
              <div className="games-modal-warning" role="alert">
                ⚠️ This game may collect input or require pointer lock - only play if you trust the source.
              </div>
              <div className="games-modal-player">
                <iframe
                  ref={iframeRef}
                  src={iframeSrc}
                  title={game.title}
                  className="games-modal-iframe"
                  sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms allow-presentation allow-fullscreen"
                  allow="fullscreen; gamepad; pointer-lock; autoplay"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  aria-label={`Game: ${game.title}`}
                />
              </div>
            </div>
          </div>
        );
      },
    });
  });
});

// Main GamesGallery Component (internal, used within provider)
const GamesGalleryInternal = ({ gamesSource, maxColumns = 4, className = '' }) => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { query, category, openId, setOpenId, setGames: setContextGames } = useGallery();

  useEffect(() => {
    const loadGames = async () => {
      try {
        setLoading(true);
        let gamesData;

        if (Array.isArray(gamesSource)) {
          gamesData = gamesSource;
        } else if (typeof gamesSource === 'string') {
          // URL to games.json
          const response = await fetch(gamesSource);
          if (!response.ok) {
            throw new Error(`Failed to load games: ${response.statusText}`);
          }
          gamesData = await response.json();
        } else {
          // Default: try to load from /games.json
          const response = await fetch('/games.json');
          if (!response.ok) {
            throw new Error(`Failed to load games: ${response.statusText}`);
          }
          gamesData = await response.json();
        }

        if (!Array.isArray(gamesData)) {
          throw new Error('Games data must be an array');
        }

        setGames(gamesData);
        setContextGames(gamesData);
        setError(null);
      } catch (err) {
        console.error('Error loading games:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadGames();
  }, [gamesSource, setContextGames]);

  // Filter games
  const filteredGames = React.useMemo(() => {
    return games.filter((game) => {
      const matchesQuery =
        !query ||
        game.title?.toLowerCase().includes(query.toLowerCase()) ||
        game.description?.toLowerCase().includes(query.toLowerCase()) ||
        game.category?.toLowerCase().includes(query.toLowerCase());

      const matchesCategory = category === 'All' || game.category === category;

      // Show all games in the list (approved status is checked when playing)
      return matchesQuery && matchesCategory;
    });
  }, [games, query, category]);

  const openGame = games.find((g) => g.id === openId);

  return (
    <div className={`games-gallery ${className}`}>
      <div className="games-gallery-header">
        <h1 className="games-gallery-title">Games Gallery</h1>
        <SearchBox />
        <CategoryPicker />
      </div>

      {loading && (
        <div className="games-loading" role="status" aria-live="polite">
          Loading games...
        </div>
      )}

      {error && (
        <div className="games-error" role="alert">
          <p>Error loading games: {error}</p>
          <p>Please check that games.json exists and is valid.</p>
        </div>
      )}

      {!loading && !error && filteredGames.length === 0 && (
        <div className="games-empty" role="status">
          <p>No games found matching your search.</p>
        </div>
      )}

      {!loading && !error && filteredGames.length > 0 && (
        <div
          className="games-grid"
          id="games-grid"
          role="grid"
          aria-label="Games grid"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))`,
            maxWidth: maxColumns ? `${maxColumns * 320}px` : '100%',
          }}
        >
          {filteredGames.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}

      {openGame && (
        <React.Suspense
          fallback={
            <div className="games-modal-overlay">
              <div className="games-modal">
                <div className="games-loading">Loading game...</div>
              </div>
            </div>
          }
        >
          <ModalPlayer game={openGame} onClose={() => setOpenId(null)} />
        </React.Suspense>
      )}
    </div>
  );
};

// Export with Provider wrapper
const GamesGallery = (props) => {
  return (
    <GalleryProvider>
      <GamesGalleryInternal {...props} />
    </GalleryProvider>
  );
};

export default GamesGallery;
export { GamesGallery as GamesGalleryInternal, GalleryProvider, useGallery };

