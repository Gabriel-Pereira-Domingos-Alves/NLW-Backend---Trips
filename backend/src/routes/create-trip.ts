import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { dayjs } from "../lib/dayjs";
import nodemailer from "nodemailer";
import { z } from "zod";
import { getMailClient } from "../lib/mail";
import { ClientError } from "../errors/client-error";
import { env } from "../env";

export async function createTrip(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post("/trips", {
    schema: {
      body: z.object({
        destination: z.string().min(4),
        starts_at: z.coerce.date(),
        ends_at: z.coerce.date(),
        owner_name: z.string(),
        owner_email: z.string().email(),
        emails_to_invite: z.array(z.string().email()),
      }),
    },
  }, async (request) => {
    const { destination, starts_at, ends_at, owner_name, owner_email, emails_to_invite } = request.body;
    
    if (dayjs(starts_at).isBefore(new Date())) {
      throw new ClientError("Starts at date must be in the future");
    }

    if (dayjs(ends_at).isBefore(starts_at)) {
      throw new ClientError("Ends at date must be after starts at date");
    }


    const trip = await prisma.trip.create({
      data: {
        destination,
        starts_at,
        ends_at,
        participants: {
          createMany: {
            data: [
              {
                name: owner_name,
                email: owner_email,
                is_owner: true,
                is_confirmed: true
            },
            ...emails_to_invite.map(email => {
                return { email }
              })
            ]
          }
        }
      }
    });

    const formatedStartsAt = dayjs(starts_at).format('LL');
    const formatedEndsAt = dayjs(ends_at).format('LL');

    const ConfirmationLink = `${env.API_BASE_URL}/trips/${trip.id}/confirm`

    const mail = await getMailClient();

    const message = await mail.sendMail({
      from: {
        name: 'Planner',
        address: 'planner@me.com'
      },
      to: {
        name: owner_name,
        address: owner_email
      },
      subject: `Confirme sua viagem em ${destination}`,
      html: `
        <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
          <h1>Você solicita uma viagem para ${destination}</h1>
          <p>Destination: ${destination}</p>
          <p>Starts at: ${formatedStartsAt}</p>
          <p>Ends at: ${formatedEndsAt}</p>
          <p>Owner name: ${owner_name}</p>
          <p>Owner email: ${owner_email}</p>
          <p>Emails to invite: ${emails_to_invite.join(', ')}</p>
          <p><a href="${ConfirmationLink}">Confirmar sua viagem</a></p></p>
        </div>
      `
    })

    console.log(nodemailer.getTestMessageUrl(message));

    return { trip: trip.id };
  });
}