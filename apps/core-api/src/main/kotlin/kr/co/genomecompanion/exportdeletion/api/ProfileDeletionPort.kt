package kr.co.genomecompanion.exportdeletion.api

import java.util.UUID


data class ProfileDeletionCommand(
    val subjectId: String,
    val sourceEventId: UUID,
)


fun interface ProfileDeletionPort {
    fun requestDeletion(command: ProfileDeletionCommand): UUID
}
