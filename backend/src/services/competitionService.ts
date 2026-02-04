import db from '../config/db'

export class CompetitionService {
  async createCompetition(
    userId: string,
    data: { name: string; startDate: Date; endDate: Date; initialBalance: number },
  ) {
    const trx = await db.transaction()
    try {
      // Create competition
      const [competition] = await trx('competitions')
        .insert({
          name: data.name,
          start_date: data.startDate,
          end_date: data.endDate,
          initial_balance: data.initialBalance,
          created_by: userId,
          status: 'active', // simplified for now
        })
        .returning('*')

      // Add creator as first participant
      await trx('portfolios').insert({
        user_id: userId,
        competition_id: competition.id,
        cash_balance: data.initialBalance,
      })

      await trx.commit()
      return competition
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  async joinCompetition(userId: string, competitionId: string) {
    const competition = await db('competitions').where({ id: competitionId }).first()
    if (!competition) {
      throw new Error('Competition not found')
    }

    // Check if already joined
    const existing = await db('portfolios')
      .where({ user_id: userId, competition_id: competitionId })
      .first()
    if (existing) {
      throw new Error('Already joined this competition')
    }

    const [portfolio] = await db('portfolios')
      .insert({
        user_id: userId,
        competition_id: competitionId,
        cash_balance: competition.initial_balance,
      })
      .returning('*')

    return portfolio
  }

  async getCompetitions() {
    return await db('competitions').select('*')
  }

  async getCompetition(id: string) {
    return await db('competitions').where({ id }).first()
  }
}

export default new CompetitionService()
