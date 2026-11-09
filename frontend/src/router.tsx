import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppLayout } from './components/layout/AppLayout'
import { CreateEventPage } from './pages/CreateEventPage'
import { EditEventPage } from './pages/EditEventPage'
import { EventDetailsPage } from './pages/EventDetailsPage'
import { EventsListPage } from './pages/EventsListPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RouteErrorPage } from './pages/RouteErrorPage'

const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        // Errors thrown by a page render here, inside the layout, so the header stays usable.
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <EventsListPage /> },
          { path: 'events/new', element: <CreateEventPage /> },
          { path: 'events/:eventId', element: <EventDetailsPage /> },
          { path: 'events/:eventId/edit', element: <EditEventPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
