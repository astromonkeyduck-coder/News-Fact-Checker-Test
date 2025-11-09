/**
 * Jest tests for GamesGallery component
 * 
 * Run with: npm test -- GamesGallery.test.js
 * 
 * Requires:
 * - @testing-library/react
 * - @testing-library/jest-dom
 * - jest
 * - jest-environment-jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GamesGallery from '../GamesGallery';

// Mock games data
const mockGames = [
  {
    id: 'stunt-city',
    title: 'Stunt City',
    category: 'Driving',
    src: '/games/stunt-city/index.html',
    thumb: '/games/stunt-city/cover.jpg',
    description: 'Open-map stunt driving',
    approved: true,
  },
  {
    id: 'parkour-blocks',
    title: 'Parkour Blocks',
    category: 'Parkour',
    src: '/games/parkour-blocks/index.html',
    thumb: '/games/parkour-blocks/cover.jpg',
    description: 'Navigate through challenging parkour courses',
    approved: true,
  },
  {
    id: 'puzzle-master',
    title: 'Puzzle Master',
    category: 'Puzzle',
    src: '/games/puzzle-master/index.html',
    thumb: '/games/puzzle-master/cover.jpg',
    description: 'Challenge your mind with intricate puzzles',
    approved: true,
  },
  {
    id: 'unapproved-game',
    title: 'Unapproved Game',
    category: 'Driving',
    src: '/games/unapproved/index.html',
    thumb: '/games/unapproved/cover.jpg',
    description: 'This game is not approved',
    approved: false,
  },
];

// Mock fetch for games.json
global.fetch = jest.fn((url) => {
  if (url === '/games.json' || url.includes('games.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockGames),
    });
  }
  return Promise.reject(new Error('Not found'));
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

describe('GamesGallery', () => {
  beforeEach(() => {
    fetch.mockClear();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockClear();
  });

  test('renders gallery with title', async () => {
    render(<GamesGallery gamesSource={mockGames} />);
    
    await waitFor(() => {
      expect(screen.getByText('Games Gallery')).toBeInTheDocument();
    });
  });

  test('displays all approved games', async () => {
    render(<GamesGallery gamesSource={mockGames} />);
    
    await waitFor(() => {
      expect(screen.getByText('Stunt City')).toBeInTheDocument();
      expect(screen.getByText('Parkour Blocks')).toBeInTheDocument();
      expect(screen.getByText('Puzzle Master')).toBeInTheDocument();
    });
  });

  test('search filters games by title', async () => {
    render(<GamesGallery gamesSource={mockGames} />);
    
    await waitFor(() => {
      expect(screen.getByText('Stunt City')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search games/i);
    fireEvent.change(searchInput, { target: { value: 'stunt' } });

    await waitFor(() => {
      expect(screen.getByText('Stunt City')).toBeInTheDocument();
      expect(screen.queryByText('Parkour Blocks')).not.toBeInTheDocument();
    });
  });

  test('search filters games by description', async () => {
    render(<GamesGallery gamesSource={mockGames} />);
    
    await waitFor(() => {
      expect(screen.getByText('Parkour Blocks')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search games/i);
    fireEvent.change(searchInput, { target: { value: 'challenging' } });

    await waitFor(() => {
      expect(screen.getByText('Parkour Blocks')).toBeInTheDocument();
      expect(screen.queryByText('Stunt City')).not.toBeInTheDocument();
    });
  });

  test('category filter shows only selected category', async () => {
    render(<GamesGallery gamesSource={mockGames} />);
    
    await waitFor(() => {
      expect(screen.getByText('Stunt City')).toBeInTheDocument();
    });

    const parkourButton = screen.getByRole('tab', { name: 'Parkour' });
    fireEvent.click(parkourButton);

    await waitFor(() => {
      expect(screen.getByText('Parkour Blocks')).toBeInTheDocument();
      expect(screen.queryByText('Stunt City')).not.toBeInTheDocument();
      expect(screen.queryByText('Puzzle Master')).not.toBeInTheDocument();
    });
  });

  test('category filter "All" shows all games', async () => {
    render(<GamesGallery gamesSource={mockGames} />);
    
    await waitFor(() => {
      expect(screen.getByText('Stunt City')).toBeInTheDocument();
    });

    // Click Parkour first
    const parkourButton = screen.getByRole('tab', { name: 'Parkour' });
    fireEvent.click(parkourButton);

    await waitFor(() => {
      expect(screen.queryByText('Stunt City')).not.toBeInTheDocument();
    });

    // Click All
    const allButton = screen.getByRole('tab', { name: 'All' });
    fireEvent.click(allButton);

    await waitFor(() => {
      expect(screen.getByText('Stunt City')).toBeInTheDocument();
      expect(screen.getByText('Parkour Blocks')).toBeInTheDocument();
      expect(screen.getByText('Puzzle Master')).toBeInTheDocument();
    });
  });

  test('clicking Play button opens modal', async () => {
    // Mock window.alert to prevent test failures
    window.alert = jest.fn();

    render(<GamesGallery gamesSource={mockGames} />);
    
    await waitFor(() => {
      expect(screen.getByText('Stunt City')).toBeInTheDocument();
    });

    const playButtons = screen.getAllByText(/play/i);
    const firstPlayButton = playButtons.find(btn => 
      btn.closest('.games-card')?.textContent.includes('Stunt City')
    );

    if (firstPlayButton) {
      fireEvent.click(firstPlayButton);

      await waitFor(() => {
        // Modal should open (check for close button or modal title)
        const closeButton = screen.queryByLabelText(/close modal/i);
        expect(closeButton).toBeInTheDocument();
      });
    }
  });

  test('unapproved games show warning and block play', async () => {
    // Mock window.alert
    window.alert = jest.fn();

    render(<GamesGallery gamesSource={mockGames} />);
    
    await waitFor(() => {
      expect(screen.getByText('Unapproved Game')).toBeInTheDocument();
    });

    // Check for warning badge
    const warning = screen.getByText(/pending approval/i);
    expect(warning).toBeInTheDocument();

    // Try to play
    const playButtons = screen.getAllByText(/play/i);
    const unapprovedPlayButton = playButtons.find(btn => 
      btn.closest('.games-card')?.textContent.includes('Unapproved Game')
    );

    if (unapprovedPlayButton) {
      fireEvent.click(unapprovedPlayButton);
      
      // Should show alert
      expect(window.alert).toHaveBeenCalledWith(
        'This game is pending approval and cannot be played yet.'
      );
    }
  });

  test('search input can be cleared', async () => {
    render(<GamesGallery gamesSource={mockGames} />);
    
    await waitFor(() => {
      expect(screen.getByText('Stunt City')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search games/i);
    fireEvent.change(searchInput, { target: { value: 'stunt' } });

    await waitFor(() => {
      expect(screen.queryByText('Parkour Blocks')).not.toBeInTheDocument();
    });

    // Find and click clear button
    const clearButton = screen.getByLabelText(/clear search/i);
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(searchInput.value).toBe('');
      expect(screen.getByText('Parkour Blocks')).toBeInTheDocument();
    });
  });

  test('loads games from URL', async () => {
    render(<GamesGallery gamesSource="/games.json" />);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/games.json');
      expect(screen.getByText('Stunt City')).toBeInTheDocument();
    });
  });

  test('shows error when games fail to load', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<GamesGallery gamesSource="/games.json" />);
    
    await waitFor(() => {
      expect(screen.getByText(/error loading games/i)).toBeInTheDocument();
    });
  });

  test('shows empty state when no games match filter', async () => {
    render(<GamesGallery gamesSource={mockGames} />);
    
    await waitFor(() => {
      expect(screen.getByText('Stunt City')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search games/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent-game-xyz' } });

    await waitFor(() => {
      expect(screen.getByText(/no games found/i)).toBeInTheDocument();
    });
  });

  test('keyboard shortcut K focuses search', async () => {
    render(<GamesGallery gamesSource={mockGames} />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search games/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search games/i);
    
    // Simulate K key press
    fireEvent.keyDown(document, { key: 'K' });

    await waitFor(() => {
      expect(document.activeElement).toBe(searchInput);
    });
  });
});

