import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getMailClient } from "../lib/mail";
import { dayjs } from "../lib/dayjs";
import nodemailer from "nodemailer";
import { ClientError } from "../errors/client-error";
import { env } from "../env";

export async function confirmTrip(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get("/trips/:tripId/confirm", {
    schema: {
      params: z.object({
        tripId: z.string(),
      }),
    },
  }, async (request, reply) => {
    const { tripId } = request.params

    const trip = await prisma.trip.findUnique({
      where: {
        id: tripId
      },
      include: {
        participants: {
          where: {
            is_owner: false
          }}
      }
    })

    if (!trip) {
      throw new ClientError("Trip not found")
    }

    if (trip.is_confirmed) {
      return reply.redirect('/')
    }

    await prisma.trip.update({
      where: { id: tripId },
      data: { is_confirmed: true }
    })

    const formatedStartsAt = dayjs(trip.starts_at).format('LL');
    const formatedEndsAt = dayjs(trip.ends_at).format('LL');

    const mail = await getMailClient();

    await Promise.all(
      trip.participants.map(async (participant) => {
        const ConfirmationLink = `${env.API_BASE_URL}/participants/${participant.id}/confirm`

        const message = await mail.sendMail({
          from: {
            name: 'Planner',
            address: 'planner@me.com'
          },
          to: participant.email,
          subject: `Confirme sua viagem em ${trip.destination}`,
          html: `
            <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
              <h1>Você foi convidado para uma viagem em ${trip.destination}</h1>
              <p>Destination: ${trip.destination}</p>
              <p>Starts at: ${formatedStartsAt}</p>
              <p>Ends at: ${formatedEndsAt}</p>
              <p>Confirme sua viagem clicando no link abaixo:</p>
              <p><a href="${ConfirmationLink}">Confirmar sua viagem</a></p></p>
            </div>
          `
        })

        console.log(nodemailer.getTestMessageUrl(message))
      })
    )

    return reply.redirect(`${env.WEB_BASE_URL}/trips/${tripId}`);
  });
}