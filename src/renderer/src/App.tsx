import { HashRouter, Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { Dashboard } from './routes/Dashboard'
import { ProjectsList } from './routes/ProjectsList'
import { ProjectDetail } from './routes/ProjectDetail'
import { JiraDetailPage } from './routes/JiraDetailPage'
import { DailyLogPage } from './routes/DailyLogPage'
import { NotesPage } from './routes/NotesPage'
import { SettingsPage } from './routes/SettingsPage'

function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectsList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/jira/:jiraId" element={<JiraDetailPage />} />
            <Route path="/daily-log" element={<DailyLogPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  )
}

export default App
