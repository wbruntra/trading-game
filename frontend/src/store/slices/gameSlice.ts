import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../index'

interface GameState {
  activeCompetitionId: string | null
}

const initialState: GameState = {
  activeCompetitionId: localStorage.getItem('activeCompetitionId') || null,
}

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setActiveCompetition: (state, action: PayloadAction<string>) => {
      state.activeCompetitionId = action.payload
      localStorage.setItem('activeCompetitionId', action.payload)
    },
    clearActiveCompetition: (state) => {
      state.activeCompetitionId = null
      localStorage.removeItem('activeCompetitionId')
    },
  },
})

export const { setActiveCompetition, clearActiveCompetition } = gameSlice.actions

export const selectActiveCompetitionId = (state: RootState) => state.game.activeCompetitionId

export default gameSlice.reducer
