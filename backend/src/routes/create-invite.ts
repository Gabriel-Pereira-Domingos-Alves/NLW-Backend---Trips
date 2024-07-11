import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import nodemailer from "nodemailer";
import { ClientError } from "../errors/client-error";
import { env } from "../env";

export async function createInvite(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post("/trips/:tripId/invites", {
    schema: {
      params: z.object({
        tripId: z.string().uuid(),
      }),
      body: z.object({
        email: z.string().email(),
      }),
    },
  }, async (request) => {
    const { tripId } = request.params;
    const { email } = request.body;
    
    const trip = await prisma.trip.findUnique({
      where: {
        id: tripId
      }
    });

    if (!trip) {
      throw new ClientError("Trip not found");
    }

    const participant = await prisma.participant.create({
      data: {
        email,
        trip_id: trip.id
      }
    })     
    
    const formatedStartsAt = dayjs(trip.starts_at).format('LL');
    const formatedEndsAt = dayjs(trip.ends_at).format('LL');

    const mail = await getMailClient();

    const ConfirmationLink = `${env.API_BASE_URL}/trips/${trip.id}/confirm`;
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

    return { participantId: participant.id };
  });
}