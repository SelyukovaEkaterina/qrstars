import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";

interface Props {
  params: Promise<{ estId: string }>;
}

export default async function PrivacyPolicyPage({ params }: Props) {
  const { estId } = await params;

  const est = await prisma.establishment.findUnique({
    where: { id: estId },
    select: {
      id: true,
      name: true,
      legalName: true,
      inn: true,
      address: true,
      notificationEmail: true,
    },
  });

  if (!est || !est.legalName || !est.inn) {
    notFound();
  }

  const today = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Политика обработки персональных данных
        </h1>
        <p className="text-sm text-gray-500 mb-8">Дата публикации: {today}</p>

        <Section title="1. Оператор персональных данных">
          <p>
            Оператором персональных данных в соответствии с настоящей Политикой является:
          </p>
          <ul className="mt-2 space-y-1">
            <li><b>Наименование:</b> {est.legalName}</li>
            <li><b>ИНН:</b> {est.inn}</li>
            {est.address && <li><b>Адрес:</b> {est.address}</li>}
            {est.notificationEmail && (
              <li>
                <b>Контактный email:</b>{" "}
                <a href={`mailto:${est.notificationEmail}`} className="text-indigo-600 underline">
                  {est.notificationEmail}
                </a>
              </li>
            )}
          </ul>
        </Section>

        <Section title="2. Платформа">
          <p>
            Сбор персональных данных осуществляется через платформу <b>QrStars</b>, предоставленную
            ИП Красников И.Г. QrStars является исключительно техническим посредником,
            предоставляющим программные инструменты для организации{" "}
            <b>{est.name}</b>, и не является самостоятельным оператором
            персональных данных, собираемых через данную форму.
          </p>
        </Section>

        <Section title="3. Цель сбора персональных данных">
          <p>Персональные данные обрабатываются в следующих целях:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Получение обратной связи и отзывов о качестве услуг заведения <b>{est.name}</b>;</li>
            <li>Обработка заявок и заказов;</li>
            <li>Связь с клиентом по его обращению;</li>
            <li>Улучшение качества предоставляемых услуг.</li>
          </ul>
        </Section>

        <Section title="4. Состав персональных данных">
          <p>Могут обрабатываться следующие данные:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Имя (имя и фамилия);</li>
            <li>Номер телефона;</li>
            <li>Адрес электронной почты (email);</li>
            <li>Текст сообщения, отзыва или заявки;</li>
            <li>Технические данные: IP-адрес, регион, тип устройства и браузера (собираются автоматически для безопасности).</li>
          </ul>
        </Section>

        <Section title="5. Правовое основание">
          <p>
            Обработка персональных данных осуществляется на основании согласия субъекта персональных
            данных (п. 1 ч. 1 ст. 6 Федерального закона № 152-ФЗ «О персональных данных»).
            Согласие выражается при заполнении формы путём установки соответствующего флажка.
          </p>
        </Section>

        <Section title="6. Срок хранения данных">
          <p>
            Персональные данные хранятся в течение срока, необходимого для достижения целей
            обработки, либо до момента отзыва согласия субъектом персональных данных.
          </p>
        </Section>

        <Section title="7. Передача третьим лицам">
          <p>
            Персональные данные не передаются третьим лицам, за исключением случаев,
            предусмотренных законодательством Российской Федерации. Технический доступ к данным
            имеет ИП Красников И.Г. (платформа QrStars) исключительно в целях технической поддержки
            и обеспечения работоспособности сервиса.
          </p>
        </Section>

        <Section title="8. Права субъекта персональных данных">
          <p>Вы вправе:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Получить информацию об обработке ваших данных;</li>
            <li>Потребовать исправления или удаления ваших данных;</li>
            <li>Отозвать согласие на обработку персональных данных;</li>
            <li>Обратиться с жалобой в Роскомнадзор.</li>
          </ul>
          {est.notificationEmail && (
            <p className="mt-2">
              Для реализации прав обращайтесь по адресу:{" "}
              <a href={`mailto:${est.notificationEmail}`} className="text-indigo-600 underline">
                {est.notificationEmail}
              </a>
            </p>
          )}
        </Section>

        <Section title="9. Безопасность данных">
          <p>
            Оператор принимает необходимые организационные и технические меры для защиты
            персональных данных от несанкционированного доступа, изменения, раскрытия или уничтожения.
          </p>
        </Section>

        <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400 text-center">
          Политика опубликована для заведения «{est.name}» · Платформа QrStars.ru (ИП Красников И.Г.)
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-base font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
