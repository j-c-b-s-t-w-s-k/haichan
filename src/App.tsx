import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { BoardsPage } from './pages/BoardsPage'
import { ThreadsPage } from './pages/ThreadsPage'
import { BlogsPage } from './pages/BlogsPage'
import { BlogPostPage } from './pages/BlogPostPage'
import { NewBlogPostPage } from './pages/NewBlogPostPage'
import { UserBlogPage } from './pages/UserBlogPage'
import { BlogCustomizationPage } from './pages/BlogCustomizationPage'
import { NewThreadPage } from './pages/NewThreadPage'
import { NewReplyPage } from './pages/NewReplyPage'
import { ThreadDetailPage } from './pages/ThreadDetailPage'
import { MinePage } from './pages/MinePage'
import { CanvasPage } from './pages/CanvasPage'
import { AdminInvitesPage } from './pages/AdminInvitesPage'
import { ChatPage } from './pages/ChatPage'
import { ChatRoomsPage } from './pages/ChatRoomsPage'
import { CreateBoardPage } from './pages/CreateBoardPage'
import { CreateChatRoomPage } from './pages/CreateChatRoomPage'
import { GamesPage } from './pages/GamesPage'
import { HashlePage } from './pages/HashlePage'
import { ImagesPage } from './pages/ImagesPage'
import { LastUsedImagesPage } from './pages/LastUsedImagesPage'
import { MigrateImagesPage } from './pages/MigrateImagesPage'
import { SettingsPage } from './pages/SettingsPage'
import { AdminPanelPage } from './pages/AdminPanelPage'
import { ProfilePage } from './pages/ProfilePage'
import { ThesisPage } from './pages/ThesisPage'
import SeedPage from './pages/SeedPage'
import { Toaster } from 'react-hot-toast'
import { MiningManager } from './lib/mining/MiningManager'
import { NotificationsPage } from './pages/NotificationsPage'

/**
 * Protected route component that redirects unauthenticated users
 * Uses AuthContext for centralized auth state management
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">▓▓▓▓▓▓▓▓</div>
          <div className="text-sm">LOADING...</div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}

/**
 * App Routes Component
 * Contains all route definitions and protected route logic
 */
function AppRoutes() {
  // Initialize background mining on app startup
  useEffect(() => {
    try {
      console.log('[App] Initializing MiningManager and background mining...')
      const manager = MiningManager.getInstance()
      
      // START BACKGROUND MINING - This is critical for showing hash rate!
      manager.startBackgroundMining('global')
      console.log('[App] ✓ MiningManager initialized with background mining ACTIVE')

      return () => {
        try {
          console.log('[App] Cleaning up MiningManager')
          // Don't destroy the manager - keep it running for the entire session
          // manager.destroy()
        } catch (error) {
          console.error('[App] Error during cleanup:', error)
        }
      }
    } catch (error) {
      console.error('[App] Failed to initialize mining:', error)
    }
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster position="bottom-right" />
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="/register" element={<Navigate to="/auth" replace />} />
          <Route path="/seed" element={<SeedPage />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/thesis" element={<ThesisPage />} />
            
            {/* Public Board Routes */}
            <Route path="/board/:boardSlug" element={<ThreadsPage />} />
            <Route path="/board/:boardSlug/thread/:threadId" element={<ThreadDetailPage />} />
            <Route path="/boards" element={<BoardsPage />} />
            
            {/* Protected Board Actions */}
            <Route path="/board/:boardSlug/thread/:threadId/reply" element={
              <ProtectedRoute>
                <NewReplyPage />
              </ProtectedRoute>
            } />
            <Route path="/board/:boardSlug/new" element={
              <ProtectedRoute>
                <NewThreadPage />
              </ProtectedRoute>
            } />
            <Route path="/boards/create" element={
              <ProtectedRoute>
                <CreateBoardPage />
              </ProtectedRoute>
            } />

            {/* Public Blog Routes */}
            <Route path="/blogs" element={<BlogsPage />} />
            <Route path="/blog/:id" element={<BlogPostPage />} />
            <Route path="/blog/user/:username" element={<UserBlogPage />} />

            {/* Protected Blog Actions */}
            <Route path="/blogs/new" element={
              <ProtectedRoute>
                <NewBlogPostPage />
              </ProtectedRoute>
            } />
            <Route path="/blog/customize" element={
              <ProtectedRoute>
                <BlogCustomizationPage />
              </ProtectedRoute>
            } />
            
            <Route path="/notifications" element={<NotificationsPage />} />
            
            {/* Protected Mining & Personal */}
            <Route path="/mine" element={
              <ProtectedRoute>
                <MinePage />
              </ProtectedRoute>
            } />
            
            <Route path="/canvas" element={<CanvasPage />} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/games/hashle" element={<HashlePage />} />
            
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/rooms" element={<ChatRoomsPage />} />
            <Route path="/rooms/create" element={
              <ProtectedRoute>
                <CreateChatRoomPage />
              </ProtectedRoute>
            } />

            <Route path="/images" element={<ImagesPage />} />
            <Route path="/images/last-used" element={<LastUsedImagesPage />} />
            <Route path="/images/migrate" element={
              <ProtectedRoute>
                <MigrateImagesPage />
              </ProtectedRoute>
            } />

            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } />
            
            {/* Profile - My profile protected, public profile public */}
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/profile/:userId" element={<ProfilePage />} />

            {/* Admin Protected */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminPanelPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/invites" element={
              <ProtectedRoute>
                <AdminInvitesPage />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

/**
 * Main App Component
 * Wraps all routes with AuthProvider for centralized auth state
 */
function App() {
  // Apply theme on startup
  useEffect(() => {
    const saved = localStorage.getItem('haichan-settings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.theme) {
          document.documentElement.setAttribute('data-theme', parsed.theme)
        }
      } catch (e) {
        // ignore
      }
    }
  }, [])

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
