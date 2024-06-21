import {Fragment, PropsWithChildren} from "react";

import cn from "@edgedb/common/utils/classNames";
import {
  DocsIcon,
  ExternalLinkIcon,
  NewUpdatesIcon,
  UpgradeIcon,
} from "@edgedb/common/newui";

import {HorizontalCardList} from "@edgedb/common/newui/horizontalCardList";

import styles from "./infoCards.module.scss";
import {LatestInfo, useLatestInfo} from "./getLatestInfo";

export interface InfoCardDef {
  priority: number;
  card: JSX.Element;
}

export function InfoCards({
  className,
  listClassName,
  extraCards,
  currentVersion,
}: {
  className?: string;
  listClassName?: string;
  extraCards?: (InfoCardDef | null)[];
  currentVersion?: {major: number; minor: number; stage: string} | null;
}) {
  const data = useLatestInfo();

  const cards: (InfoCardDef | null)[] = [
    {
      priority: 0,
      card: (
        <InfoCard
          title="Learn EdgeDB"
          icon={<DocsIcon />}
          link="https://docs.edgedb.com"
        >
          Check out our docs for to learn everything you need to know about
          EdgeDB, from helpful guides to full API reference docs.
        </InfoCard>
      ),
    },
    data?.latestBlogPost
      ? {
          priority: 1,
          card: <BlogCard data={data.latestBlogPost} />,
        }
      : null,
    data?.latestUpdate
      ? {
          priority: 1,
          card: (
            <InfoCard
              title="What's New in EdgeDB"
              icon={<NewUpdatesIcon />}
              link={data.latestUpdate.url}
            >
              {data.latestUpdate.title} <br />
              <u>Read more...</u>
            </InfoCard>
          ),
        }
      : null,
    data?.latestEdgeDBVersion &&
    currentVersion &&
    (data.latestEdgeDBVersion.major > currentVersion.major ||
      (data.latestEdgeDBVersion.major === currentVersion.major &&
        data.latestEdgeDBVersion.minor > currentVersion.minor))
      ? {
          priority: 3,
          card: (
            <InfoCard
              title={`EdgeDB ${data.latestEdgeDBVersion.major}.${data.latestEdgeDBVersion.minor} is available`}
              icon={<UpgradeIcon />}
              link={`https://docs.edgedb.com/changelog/${data.latestEdgeDBVersion.major}_x`}
            >
              This instance is ready to update to the latest version of EdgeDB.{" "}
              <u>Find out what's new in the changelog.</u>
            </InfoCard>
          ),
        }
      : null,
    ...(extraCards ?? []),
  ];

  return (
    <HorizontalCardList
      className={cn(styles.infoCardsList, className)}
      listClassName={listClassName}
    >
      {cards
        .filter((c) => c != null)
        .sort((a, b) => b!.priority - a!.priority)
        .map((card, i) => (
          <Fragment key={i}>{card!.card}</Fragment>
        ))}
    </HorizontalCardList>
  );
}

export type InfoCardProps = {
  title: string;
  icon?: JSX.Element;
  link:
    | string
    | ((props: PropsWithChildren<{className?: string}>) => JSX.Element);
};

export function InfoCard({
  title,
  icon,
  link,
  children,
}: PropsWithChildren<InfoCardProps>) {
  const content = (
    <>
      <div className={styles.title}>
        {icon}
        {title}
      </div>
      <div className={styles.content}>{children}</div>
    </>
  );

  if (typeof link === "string") {
    return (
      <a href={link} target="_blank" className={styles.infoCard}>
        {content}
        <ExternalLinkIcon />
      </a>
    );
  }

  const Link = link;
  return <Link className={styles.infoCard}>{content}</Link>;
}

function BlogCard({data}: {data: LatestInfo["latestBlogPost"]}) {
  return (
    <a
      href={data.url}
      target="_blank"
      className={cn(styles.infoCard, styles.blogCard, {
        [styles.darkCard]: data.imageBrightness < 0.7,
      })}
    >
      <div className={styles.title}>Read our latest blog post</div>
      <div className={styles.blogDate}>
        {new Date(data.publishedTimestamp).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>
      <div className={styles.blogTitle}>{data.title}</div>
      <div
        className={styles.blogImage}
        style={
          {
            backgroundImage: `url(${data.imageUrl})`,
            "--brightness":
              data.imageBrightness < 0.4
                ? "80%"
                : data.imageBrightness < 0.7
                ? "60%"
                : "110%",
          } as any
        }
      />
      <ExternalLinkIcon />
    </a>
  );
}
